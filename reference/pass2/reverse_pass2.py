#!/usr/bin/env python3
"""ROM-derived PSIV dispatcher reference and independent gameplay behavior probes.

Analyzes locally owned/authorized ROM data. Emits metadata only. No game binary or
copyrighted art/text is included in generated outputs.

Sources: user-supplied US Phantasy Star IV .md (SHA-256 pinned), crosschecked
against lory90/squidfeatures public PSIV disassembly (symbol names are community labels).
"""
import argparse
import hashlib
import json
import struct
import zipfile
from dataclasses import dataclass
from pathlib import Path

EXPECTED_SHA256 = '511f35cc11f88316f8b8940e28ab298bd75a4da193672a80172884d6eb913b6a'
GAME_MODES = (
    'GameMode_Sega', 'GameMode_Title', 'GameMode_LoadFieldMap', 'GameMode_Field',
    'GameMode_LoadBattle', 'GameMode_Battle', 'GameMode_JmpToVInt_Prepare',
)
FIELD_MODES = (
    'FieldRoutine_Controls', 'FieldRoutine_Menu', 'FieldRoutine_Interaction',
    'FieldRoutine_Event', 'FieldRoutine_Settings', 'FieldRoutine_Battle',
    'FieldRoutine_Shop', 'FieldRoutine_PlaceName', 'FieldRoutine_WorldMap',
    'FieldRoutine_ItemFound',
)
BATTLE_MODES = (
    'BattleRoutine_Nothing', 'loc_52C2', 'loc_52D6', 'loc_5380',
    'Battle_ProcessCOMD', 'Battle_ProcessMACRO', 'Battle_ProcessRUN',
    'Battle_OrderTurns', 'loc_576A', 'loc_6672', 'loc_6670',
    'Battle_DoAttackEffect', 'loc_67AE', 'loc_67BE', 'loc_5366',
    'loc_66B8', 'loc_684A', 'loc_68C0',
)
# Minimal opcode signatures just to find dispatchers. Neither a code image nor
# an instruction listing is retained in the report.
MAIN_LOOP_SIGNATURE = bytes.fromhex('3038ef00207b00064e9060f4')
FIELD_DISPATCH_SIGNATURE = bytes.fromhex('4eb90004236c3038ec20207b00044ed0')
BATTLE_DISPATCH_SIGNATURE = bytes.fromhex('3039ffff410041fa0008d0f000004ed0')


def read_rom(archive):
    with zipfile.ZipFile(archive) as z:
        paths = [name for name in z.namelist() if name.lower().endswith('.md')]
        if len(paths) != 1:
            raise ValueError('Expected precisely one .md in ZIP')
        rom = z.read(paths[0])
    sha = hashlib.sha256(rom).hexdigest()
    if sha != EXPECTED_SHA256:
        raise ValueError(f'Unknown PSIV ROM revision {sha}; offsets are not portable')
    return rom


def unique_find(rom, sig):
    pos = rom.find(sig)
    if pos == -1 or rom.find(sig, pos+1) != -1:
        raise ValueError('Expected unique target signature')
    return pos


def unpack_routes(rom, offset, names, width=4, relative=False):
    rows=[]
    for i,name in enumerate(names):
        pos = offset + i*width
        if width == 4:
            value = struct.unpack_from('>I',rom,pos)[0]
            target = value
        else:
            value = struct.unpack_from('>h',rom,pos)[0]
            target = offset + value
        if target >= len(rom) or target < 0 or target % 2:
            raise ValueError(f'Bad dispatch target for {name}: {target:x}')
        rows.append({'index':i,'mode_offset_hex':f'0x{i*width:02X}',
                     'name':name,'entry_rom_address_hex':f'0x{target:06X}'})
    return rows


def extract_psiv(rom):
    main=unique_find(rom,MAIN_LOOP_SIGNATURE)
    # The main-loop signature includes the 12-byte dispatch, followed by
    # a table of 7 32-bit big-endian ROM routine addresses.
    assert main == 0x3D0
    modes=unpack_routes(rom,main+len(MAIN_LOOP_SIGNATURE),GAME_MODES)
    assert modes[3]['entry_rom_address_hex']=='0x05199A'
    assert modes[5]['entry_rom_address_hex']=='0x00093A'

    field=unique_find(rom,FIELD_DISPATCH_SIGNATURE)
    assert field == 0x5199A
    field_modes=unpack_routes(rom,field+len(FIELD_DISPATCH_SIGNATURE),FIELD_MODES)
    # The 18 battle routine offsets are signed 16-bit quantities relative
    # to the first entry of the table, not absolute pointers.
    battle=unique_find(rom,BATTLE_DISPATCH_SIGNATURE)
    assert battle==0x528E
    battle_modes=unpack_routes(rom,battle+len(BATTLE_DISPATCH_SIGNATURE),BATTLE_MODES,width=2,relative=True)
    assert battle_modes[7]['entry_rom_address_hex']=='0x0054CC'
    return {
      'rom_sha256':hashlib.sha256(rom).hexdigest(),
      'verification':'matched unique ROM opcode signatures and decoded their tables; names crosschecked against public disassembly',
      'dispatchers':{
        'main':{'start_hex':f'0x{main:06X}','table_hex':f'0x{main+len(MAIN_LOOP_SIGNATURE):06X}','table_type':'absolute_be32','states':modes},
        'field':{'start_hex':f'0x{field:06X}','table_hex':f'0x{field+len(FIELD_DISPATCH_SIGNATURE):06X}','table_type':'absolute_be32','states':field_modes},
        'battle':{'start_hex':f'0x{battle:06X}','table_hex':f'0x{battle+len(BATTLE_DISPATCH_SIGNATURE):06X}','table_type':'signed_be16_relative_to_table','states':battle_modes},
      },
      'behavioral_notes':{
        'flag_bit_index':'[flag_id >> 3], bit (7 - (flag_id & 7)); IDs masked to 0..255',
        'encounter':'after 10 completed moves from map entry, 1/32 chance each completed move on foot, 1/128 in vehicle, with guard checks',
        'turn_order':'up to 5 allies + 4 enemies; eligible fighters only; agility plus RNG remainder mod floor(max agility/2); descending sort; ambush/preemptive filter',
        'save_checksum':'unsigned sum of 0xA00 bytes, modulo 0x10000; four save slots, SRAM slot stride 0x1400 (physical interleaved SRAM)',
      }
    }

class FlagBank:
    """Original independent 256-bit flag-bank model from PSIV operations."""
    def __init__(self): self.bits=bytearray(32)
    @staticmethod
    def position(flag_id):
        x=int(flag_id)&0xff
        return (x>>3, 1 << (7-(x&7)))
    def check(self,flag_id):
        pos,mask=self.position(flag_id)
        return bool(self.bits[pos]&mask)
    def set(self,flag_id):
        pos,mask=self.position(flag_id)
        self.bits[pos]|=mask
    def clear(self,flag_id):
        pos,mask=self.position(flag_id)
        self.bits[pos]&=(~mask)&0xff

@dataclass
class EncounterState:
    """Step-based implementation of the behavior documented in RunRandomBattles.

    blocked_event/transition are simplified abstraction of the ROM's multiple
    guard checks. A caller must pass *finished* moves only (not held frames).
    """
    timer:int=10
    def finished_move(self,rng_seed,*,enabled=True,vehicle=False,
                      blocked_event=False,transition_tile=False):
        if not enabled or blocked_event or transition_tile:return False
        if self.timer>1:
            self.timer-=1
            return False
        self.timer=1
        return ((rng_seed & (0x7f if vehicle else 0x1f))==0)
    def new_map(self):self.timer=10


def sum_sram_bytes(data):
    """PSIV's SumSRAMBytes reduction over 0xA00 bytes; no raw save data copied."""
    if len(data)!=0xA00:raise ValueError('PSIV save checksum region must be 2560 bytes')
    return sum(data)&0xffff


def gba_entry(rom):
    instruction=struct.unpack_from('<I',rom)[0]
    if instruction&0xff000000!=0xea000000:
        raise ValueError('First GBA instruction not expected unconditional ARM branch')
    imm=instruction&0xffffff
    disp=imm<<2
    if disp & (1<<25): disp -= (1<<26)
    return 8+disp


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--iv',required=True)
    p.add_argument('--out',required=True)
    args=p.parse_args()
    result=extract_psiv(read_rom(args.iv))
    Path(args.out).write_text(json.dumps(result,indent=2),encoding='utf-8')
    for group,data in result['dispatchers'].items():
        print(f'{group}: {len(data["states"])} verified routes, dispatcher {data["start_hex"]}')

if __name__=='__main__':main()
