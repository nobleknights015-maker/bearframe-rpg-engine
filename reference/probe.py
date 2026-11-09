"""Isolated CPU experiments on privately supplied cartridges. No ROM bytes exported."""
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
import argparse
import struct
import unittest
from zipfile import ZipFile
from unicorn import Uc, UC_ARCH_ARM, UC_ARCH_M68K, UC_MODE_THUMB, UC_MODE_BIG_ENDIAN
from unicorn.arm_const import UC_ARM_REG_R10, UC_ARM_REG_PC
from unicorn.m68k_const import UC_M68K_REG_D0, UC_M68K_REG_PC, UC_CPU_M68K_M68000

GBA_BASE = 0x08000000
RAM = 0xFFFF0000

def load(folder, filename, digest):
    with ZipFile(folder / filename) as archive:
        member, = archive.namelist()
        rom = archive.read(member)
    if sha256(rom).hexdigest() != digest:
        raise ValueError(f"Unexpected cartridge revision: {filename}")
    return rom

@dataclass(frozen=True)
class Slot:
    occupied: bool
    flags: int
    speed: int

def eligible_records(slots, opening):
    """Model the shortlist built before randomization, with one-based slot IDs."""
    start, end = (0, 9) if opening == 0 else (0, 5) if opening > 0 else (5, 9)
    return [(i+1, slots[i].speed) for i in range(start, end)
            if slots[i].occupied and not slots[i].flags & 0x6e]

class Probes(unittest.TestCase):
    def machine(self):
        cpu = Uc(UC_ARCH_M68K, UC_MODE_BIG_ENDIAN)
        cpu.ctl_set_cpu_model(UC_CPU_M68K_M68000)
        cpu.mem_map(0, len(self.iv))
        cpu.mem_write(0, self.iv)
        cpu.mem_map(RAM, 65536)
        return cpu

    def test_collection_headers_and_launch(self):
        for index, offset in enumerate((0x738000, 0x390000, 0x080000)):
            with self.subTest(index=index):
                header = self.gba[offset:offset+192]
                self.assertEqual(header[4:160], self.gba[4:160])
                self.assertEqual(header[189], (-sum(header[160:189])-25) & 255)
                cpu = Uc(UC_ARCH_ARM, UC_MODE_THUMB)
                cpu.mem_map(GBA_BASE,len(self.gba))
                cpu.mem_write(GBA_BASE,self.gba)
                cpu.mem_map(0x02000000,4096)
                cpu.mem_write(0x02000000,struct.pack('<I',index))
                cpu.reg_write(UC_ARM_REG_R10,0x02000000)
                # Execute Thumb lookup, trampoline, then embedded ARM reset branch.
                cpu.emu_start(GBA_BASE+0x783,GBA_BASE+offset+0xc0,count=15)
                self.assertEqual(cpu.reg_read(UC_ARM_REG_PC),GBA_BASE+offset+0xc0)

    def test_event_selector(self):
        for selector in (0,1,5,0x8000,0x8005,0xffff):
            cpu=self.machine()
            cpu.mem_write(RAM+0xeca8,struct.pack('>H',selector))
            target=0x5a538 if selector & 0x8000 else 0x5a27a
            cpu.emu_start(0x5a264,target,count=10)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_PC),target)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_D0),selector & 0x7fff)

    def test_combat_shortlist(self):
        slots=[Slot(i!=1, 0x82 if i==6 else 0x80, 31-i) for i in range(9)]
        for opening in (-1,0,1):
            cpu=self.machine()
            for i,slot in enumerate(slots):
                address=RAM+0x4400+64*i
                actor=RAM+0x1000+128*i
                cpu.mem_write(address,struct.pack('>HxxI',int(slot.occupied),actor))
                cpu.mem_write(actor+0x16,bytes([slot.flags]))
                cpu.mem_write(actor+0x20,bytes([slot.speed]))
            cpu.mem_write(RAM+0xee45,bytes([opening&255]))
            # Stop before TRAP 0. Begin second block with fresh zeroed scratch RAM.
            cpu.emu_start(0x54cc,0x54f0,count=150)
            for i,slot in enumerate(slots):
                expected=slot.flags & 127 if slot.occupied else slot.flags
                self.assertEqual(cpu.mem_read(RAM+0x1016+128*i,1)[0],expected)
            cpu.emu_start(0x54f2,0x554e,count=220)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_PC),0x554e)
            rows=struct.iter_unpack('>HH',cpu.mem_read(RAM+0xefb0,36))
            self.assertEqual([(i,v) for i,v in rows if i],eligible_records(slots,opening))

    def test_effect_gate(self):
        for flag1,flag2,occupied,action,blocked in [
            (1,0,0,0,True),(0,1,0,0,True),(0,0,0,7,False),
            *((0,0,1,n,n in (7,12,13,14)) for n in (1,7,12,13,14,15))
        ]:
            cpu=self.machine()
            cpu.mem_write(RAM+0xee82,bytes([flag1]))
            cpu.mem_write(RAM+0x416c,bytes([flag2]))
            cpu.mem_write(RAM+0x4600,struct.pack('>HBB',occupied,0,action))
            stop=0x5dda if blocked else 0x5d36
            cpu.emu_start(0x5ce6,stop,count=140)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_PC),stop)

    def test_packed_dungeon(self):
        # Compare tile classes on three observed rows to an external map transcription.
        sms_base=self.gba.index(b'TMR SEGA')-0x7ff0
        offset=sms_base+0x3df6e
        self.assertEqual(offset,0x7b0242)
        data=self.gba[offset:offset+24]
        cells=[n for byte in data for n in (byte>>4,byte&15)]
        self.assertEqual(set(cells[:16]),{1})
        self.assertEqual([i for i,tile in enumerate(cells[16:32]) if tile==10],[4,14])
        self.assertEqual([i for i,tile in enumerate(cells[32:48]) if tile==0],[8,10,14])

    def test_interaction_rectangle_and_set_once(self):
        from unicorn.m68k_const import UC_M68K_REG_A7, UC_M68K_REG_D7
        for px,py,preflag,hit in [(80,80,False,True),(143,143,False,True),
                                   (144,80,False,False),(80,79,False,False),(80,80,True,False)]:
            cpu=self.machine()
            cpu.reg_write(UC_M68K_REG_A7,RAM+0x8000)
            # A ten-byte record, then end marker. Facing code 0 offsets Y by +16.
            cpu.mem_write(RAM+0x1000,struct.pack('>HHHBBBBH',10,10,1,1,9,3,2,65535))
            cpu.mem_write(RAM+0xec3c,struct.pack('>I',RAM+0x1000))
            cpu.mem_write(RAM+0xc030,struct.pack('>H',px))
            cpu.mem_write(RAM+0xc034,struct.pack('>H',py-16))
            if preflag:cpu.mem_write(RAM+0xf121,b'\x40')
            cpu.mem_write(RAM+0x8000,struct.pack('>I',0x1000))
            cpu.emu_start(0x58e00,0x1000,count=300)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_PC),0x1000)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_D7),int(hit))
            self.assertEqual(cpu.mem_read(RAM+0xf121,1)[0],64 if preflag or hit else 0)

    def test_save_slots_against_ram(self):
        for slot in range(4):
            cpu=self.machine()
            payload=bytes((i*37+slot)%256 for i in range(0xa00))
            cpu.mem_write(RAM+0xf100,payload)
            cpu.emu_start(0x64ece,0x64ee2,count=12000)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_D0),sum(payload)&65535)
            physical=bytearray([197])*0x1400
            physical[1::2]=payload
            cpu.mem_write(0x200200+slot*0x1400,bytes(physical))
            cpu.reg_write(UC_M68K_REG_D0,slot+4)
            cpu.emu_start(0x64ee4,0x64f20,count=18000)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_D0),sum(payload)&65535)

    def test_order_with_deterministic_rng(self):
        from unicorn.m68k_const import UC_M68K_REG_A5, UC_M68K_REG_A7
        for seed in (1,0x6287,0xffff):
            cpu=self.machine()
            speeds=[24,31,24,12,20,0,33,9,17]
            rows=[(i+1,v) for i,v in enumerate(speeds) if v]
            rows.extend([(0,0)]*(9-len(rows)))
            cpu.mem_write(RAM+0xefb0,b''.join(struct.pack('>HH',*row) for row in rows))
            # Emulate the caller after shortlist creation, holding the external word
            # referenced through A5 constant. No mock replaces the ROM RNG routine.
            cpu.reg_write(UC_M68K_REG_A7,RAM+0x8000)
            cpu.reg_write(UC_M68K_REG_A5,RAM+0x1000)
            cpu.mem_write(RAM+0x1008,struct.pack('>H',73))
            cpu.mem_write(RAM+0xef1c,struct.pack('>H',19))
            cpu.mem_write(RAM+0xef0c,struct.pack('>H',seed))
            cpu.emu_start(0x5552,0x55a6,count=2000)
            self.assertEqual(cpu.reg_read(UC_M68K_REG_PC),0x55a6)
            predicted=[]
            for actor,speed in rows:
                rng=(73+19-seed)&0xffff
                seed=((seed>>1)|(seed<<15))&0xffff
                predicted.append((actor,speed+rng%(max(speeds)//2) if speed else 0))
            predicted.sort(key=lambda row:row[1],reverse=True)
            actual=list(struct.iter_unpack('>HH',cpu.mem_read(RAM+0xefb0,36)))
            self.assertEqual(actual,predicted)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('rom_folder',type=Path)
    folder=parser.parse_args().rom_folder
    Probes.gba=load(folder,'Phantasy Star Collection.zip','6747a17af7ccb082bab1f2a8ed7d88952ab93879d93173b12331b1e5e8ec1c4e')
    Probes.iv=load(folder,'Phantasy Star IV.zip','511f35cc11f88316f8b8940e28ab298bd75a4da193672a80172884d6eb913b6a')
    unittest.main(argv=['probe'],verbosity=2)
