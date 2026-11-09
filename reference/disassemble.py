"""Display selected instruction ranges privately from the hash-pinned cartridge pair."""
from pathlib import Path
from argparse import ArgumentParser
from capstone import (Cs,CS_ARCH_ARM,CS_ARCH_M68K,CS_MODE_ARM,CS_MODE_THUMB,
                      CS_MODE_BIG_ENDIAN,CS_MODE_M68K_000)
from probe import load

def main():
    p=ArgumentParser();p.add_argument('rom_folder',type=Path);a=p.parse_args()
    iv=load(a.rom_folder,'Phantasy Star IV.zip','511f35cc11f88316f8b8940e28ab298bd75a4da193672a80172884d6eb913b6a')
    gba=load(a.rom_folder,'Phantasy Star Collection.zip','6747a17af7ccb082bab1f2a8ed7d88952ab93879d93173b12331b1e5e8ec1c4e')
    m68k=Cs(CS_ARCH_M68K,CS_MODE_M68K_000|CS_MODE_BIG_ENDIAN)
    for rom,decoder,ranges in [
        (gba,Cs(CS_ARCH_ARM,CS_MODE_ARM),[(0,4),(0xc0,0xc4),(0x100,0x138)]),
        (gba,Cs(CS_ARCH_ARM,CS_MODE_THUMB),[(0x5e4,0x5f0),(0x782,0x792),(0x8bc,0x8be)]),
        (iv,m68k,[(0x54cc,0x54f2),(0x54f2,0x554e),(0x5552,0x55a6),(0x4239e,0x423b0),
                  (0x5ce6,0x5d36),(0x587f4,0x58836),(0x58e00,0x58eae),(0x547c2,0x547e6),
                  (0x5a264,0x5a28c),(0x5a538,0x5a54c),(0x57666,0x576a8),
                  (0x64ece,0x64ee4),(0x64ee4,0x64f22)])]:
        for start,end in ranges:
            for op in decoder.disasm(rom[start:end],start):
                print(f'{op.address:06x}  {op.mnemonic:<8} {op.op_str}')
if __name__=='__main__':main()
