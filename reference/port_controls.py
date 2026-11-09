"""Paired input experiments on the actual GBA builds of PSII and PSIII."""
import ctypes as C
from pathlib import Path
import sys
from console import Console

def game(core,rom,index):
    console=Console(core,rom)
    console.run(1700);console.run(10,3);console.run(100)
    for _ in range(index):console.run(10,5);console.run(70)
    console.run(10,8);console.run(700)
    for _ in range(6):console.run(8,3);console.run(60)
    return console

def ram_byte(console,address):
    ptr,offset,size=console.regions[0x02000000]
    assert 0<=address<size
    return C.c_ubyte.from_address(ptr+offset+address).value

def run(core,rom):
    for right,expected in [(False,11),(True,12)]:
        c=game(core,rom,1)
        try:
            c.run(8,8);c.run(60)
            if right:c.run(8,7);c.run(60)
            else:c.run(68)
            c.run(8,8);c.run(60)
            assert ram_byte(c,0x39c3)==expected
        finally:c.close()
    print('PASS PSII equal-duration first-letter A/B input comparison')
    c=game(core,rom,2)
    try:
        for _ in range(6):c.run(8,8);c.run(60)
        c.run(8000)
        samples=[]
        for key in [None,7,6,7,6,5,4]:
            c.run(16,key);c.run(40)
            samples.append((ram_byte(c,0x3f64),ram_byte(c,0x3f62)))
        assert samples==[(0,32),(16,32),(0,32),(16,32),(0,32),(0,48),(0,32)],samples
    finally:c.close()
    print('PASS PSIII reversible horizontal and vertical field-input RAM deltas')
if __name__=='__main__':run(Path(sys.argv[1]),Path(sys.argv[2]))
