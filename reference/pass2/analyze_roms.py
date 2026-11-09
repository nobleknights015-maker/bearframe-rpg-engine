#!/usr/bin/env python3
"""Read-only technical inventory for user-supplied classic console ROMs.
No ROM data, sprites, music, or disassembled copyrighted instruction listings are exported.
Run: python analyze_roms.py --collection '/path/to/collection.zip' --iv '/path/to/iv.zip' --out /path/to/output
"""
import argparse, hashlib, json, math, struct, zipfile
from pathlib import Path
from collections import Counter


def image_from_zip(path, ext):
    with zipfile.ZipFile(path) as z:
        eligible=[p for p in z.namelist() if p.lower().endswith(ext)]
        if len(eligible)!=1: raise ValueError(f'{path}: expected one {ext}, got {eligible}')
        return eligible[0],z.read(eligible[0])

def entropy(b):
    if not b:return 0.
    n=len(b);count=Counter(b)
    return round(-sum((v/n)*math.log2(v/n) for v in count.values()),4)

def blocks(b,sz=65536):
    return [{'offset_hex':f'0x{i:06X}','length':len(b[i:i+sz]),'entropy':entropy(b[i:i+sz]),'zero_percent':round(b[i:i+sz].count(0)*100/len(b[i:i+sz]),2),'ff_percent':round(b[i:i+sz].count(255)*100/len(b[i:i+sz]),2)} for i in range(0,len(b),sz)]

def sbe(b,offset):return struct.unpack_from('>H',b,offset)[0]
def lbe(b,offset):return struct.unpack_from('>I',b,offset)[0]

def genesis(b):
    header=lambda a,c:b[a:c].decode('ascii','replace').strip('\0 ')
    # M68000 exception vectors 0..63 are big endian 32-bit address slots, not all guaranteed populated.
    names={0:'initial_stack_pointer',1:'reset_program_counter',2:'bus_error',3:'address_error',4:'illegal_instruction',5:'divide_by_zero',6:'chk',7:'trapv',8:'privilege_violation',9:'trace',10:'line_1010_emulator',11:'line_1111_emulator',24:'spurious_interrupt',25:'level_1_interrupt',26:'level_2_interrupt',27:'level_3_interrupt',28:'horizontal_blank_interrupt',29:'level_5_interrupt',30:'vertical_blank_interrupt',31:'level_7_interrupt'}
    vectors=[]
    for i in range(64):
        v=lbe(b,4*i)
        vectors.append({'vector':i,'name':names.get(i,f'vector_{i}'),'address_hex':f'0x{v:08X}','rom_aligned': v%2==0 and 0x200<=v<len(b)})
    c=sbe(b,0x18e)
    # Standard Genesis checksum sums 16-bit BE words from 0x200 to end (mod 65536).
    calculated=sum(sbe(b,i) for i in range(0x200,len(b)-1,2))&0xffff
    # A survey of long-aligned even target values; these are CANDIDATES, not confirmed pointers.
    targets=Counter()
    for pos in range(0x200,len(b)-3,2):
        v=lbe(b,pos)
        if 0x200<=v<len(b) and v%2==0:targets[v//65536]+=1
    # Scan known 68000 absolute-long JSR/JMP opcodes at even offsets.
    # These are patterns only, not validated instruction boundaries.
    branches=[]
    for pos in range(0x200,len(b)-5,2):
        op=sbe(b,pos)
        if op not in (0x4EB9,0x4EF9):continue
        dest=lbe(b,pos+2)
        if 0x200<=dest<len(b) and dest%2==0:
            branches.append({'from_hex':f'0x{pos:06X}','to_hex':f'0x{dest:06X}','opcode_kind':'JSR_abs_long_candidate' if op==0x4EB9 else 'JMP_abs_long_candidate'})
    return {'type':'sega_genesis_68000','size':len(b),'sha256':hashlib.sha256(b).hexdigest(), 'header':{'hardware':header(0x100,0x110),'domestic_title':header(0x120,0x150),'overseas_title':header(0x150,0x180),'product_code':header(0x180,0x18e),'stored_checksum':f'0x{c:04X}','calculated_checksum':f'0x{calculated:04X}','checksum_matches':c==calculated,'rom_start':f'0x{lbe(b,0x1a0):08X}','rom_end':f'0x{lbe(b,0x1a4):08X}','ram_start':f'0x{lbe(b,0x1a8):08X}','ram_end':f'0x{lbe(b,0x1ac):08X}','region':header(0x1f0,0x200)},'vectors':vectors,'absolute_long_branch_pattern_candidates':{'total':len(branches),'first_40':branches[:40]},'candidate_pointer_count_by_64k_block':[{'block_hex':f'0x{key*65536:06X}','count':value} for key,value in sorted(targets.items())],'blocks':blocks(b)}

def gba(b):
    # Standard GBA header complement check: complement(0xA0..0xBC)+0x19 mod 256 == byte 0xBD
    check=(-sum(b[0xa0:0xbd])-0x19)&0xff
    # Header entry point expected a 32-bit ARM branch in 0x00000000 but only report encoding if recognized.
    instr=struct.unpack_from('<I',b,0)[0]
    is_branch=(instr&0x0e000000)==0x0a000000
    target=None
    if is_branch:
        delta=(instr&0xffffff)<<2
        if delta&0x2000000:delta-=0x4000000
        target=8+delta
    return {'type':'gba_arm7tdmi','size':len(b),'sha256':hashlib.sha256(b).hexdigest(),'header':{'title':b[0xa0:0xac].decode('ascii','replace').rstrip('\0'),'game_code':b[0xac:0xb0].decode('ascii','replace'),'maker_code':b[0xb0:0xb2].decode('ascii','replace'),'stored_header_checksum':f'0x{b[0xbd]:02X}','calculated_header_checksum':f'0x{check:02X}','checksum_matches':check==b[0xbd],'entry_opcode_hex':f'0x{instr:08X}','entry_is_arm_branch':is_branch,'entry_target_offset_hex':f'0x{target:X}' if target is not None else None},'blocks':blocks(b)}

def main():
    a=argparse.ArgumentParser(); a.add_argument('--collection',required=True);a.add_argument('--iv',required=True);a.add_argument('--out',required=True);args=a.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    n1,b1=image_from_zip(args.collection,'.gba');n2,b2=image_from_zip(args.iv,'.md')
    result={'method':'static first-pass; read-only; no execution or behavioral proof','collection':{'filename':n1,**gba(b1)},'phantasy_star_iv':{'filename':n2,**genesis(b2)}}
    (out/'rom_inventory.json').write_text(json.dumps(result,indent=2))
    print('Created',out/'rom_inventory.json')
    print('GBA header valid:',result['collection']['header']['checksum_matches'],'entry target:',result['collection']['header']['entry_target_offset_hex'])
    print('IV genesis checksum matches:',result['phantasy_star_iv']['header']['checksum_matches'])
    print('IV reset PC',result['phantasy_star_iv']['vectors'][1]['address_hex'])
    print('IV interrupt vectors:',[(x['name'],x['address_hex']) for x in result['phantasy_star_iv']['vectors'] if 'interrupt' in x['name']])
if __name__=='__main__':main()
