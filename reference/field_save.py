"""Reach the first playable town through normal inputs and save through PSIV's UI."""
from pathlib import Path
import ctypes as C
import struct
import sys
from console import Console

def replay(core,archive):
    c=Console(core,archive)
    try:
        def press(key,settle=60):
            c.run(8,key);c.run(settle)
        c.run(400)
        for _ in range(3):press(3)
        for _ in range(82):press(8,75)
        c.lib.retro_get_memory_data.restype=C.c_void_p
        c.lib.retro_get_memory_size.restype=C.c_size_t
        assert c.lib.retro_get_memory_size(2)>=65536
        ram=c.lib.retro_get_memory_data(2)
        # The tested Genesis Plus GX build exposes 68000 words in host byte order.
        def position():
            return struct.unpack('<H2xH',C.string_at(ram+0xc030,6))
        assert position()==(768,288),position()
        for direction,expected_y in [(5,320),(5,320),(4,288),(4,256)]:
            c.run(16,direction);c.run(16)
            assert position()==(768,expected_y),position()
        c.run(8,3);c.run(20)
        assert struct.unpack('<H',C.string_at(ram+0xec20,2))[0]==0x10
        c.run(7,1);c.run(40)
        size=c.lib.retro_get_memory_size(0)
        sram=c.lib.retro_get_memory_data(0)
        before=C.string_at(sram,size)
        press(8,40)
        after=C.string_at(sram,size)
        payload=after[0x201:0x1600:2]
        checksum=int.from_bytes(after[0x29:0x2c:2],'big')
        assert len(payload)==0xa00 and checksum==(sum(payload)&0xffff)
        assert checksum==0x58c0 and before!=after
        changed=sum(a!=b for a,b in zip(before,after))
        assert changed==735,changed
        print('PASS first-town movement, blocked step, reverse steps, system menu and slot 1 save')
        print('Slot 1 payload: 2560 bytes; measured checksum: 58c0; 735 SRAM bytes changed')
    finally:c.close()
    # Cold boot another console; inject only cartridge SRAM, never an emulator state.
    other=Console(core,archive)
    try:
        other.lib.retro_get_memory_data.restype=C.c_void_p
        C.memmove(other.lib.retro_get_memory_data(0),after,len(after))
        other.run(400)
        for key,settle in ((3,60),(3,60),(8,60),(8,120)):
            other.run(8,key);other.run(settle)
        ram=other.lib.retro_get_memory_data(2)
        loaded=struct.unpack('<H2xH',C.string_at(ram+0xc030,6))
        assert loaded==(768,256),loaded
        print('PASS cold boot, Continue, select slot 1, restore exact saved field position')
    finally:other.close()
if __name__=='__main__':replay(Path(sys.argv[1]),Path(sys.argv[2]))
