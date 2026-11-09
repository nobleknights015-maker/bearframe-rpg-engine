"""Replay all three title selections, check actual menu RAM and fingerprint video."""
from console import Console
import ctypes as C
import hashlib
import sys
from pathlib import Path

def replay(core,rom,index):
    c=Console(core,rom)
    try:
        c.run(1700);c.run(10,3);c.run(100)
        for _ in range(index):
            c.run(10,5);c.run(70)
        ptr,offset,size=c.regions[0x02000000]
        assert size>=0x24370,size
        ram=ptr+offset
        observed=int.from_bytes(C.string_at(ram+0x2436c,4),'little')
        assert observed==index,(observed,index)
        c.run(10,8);c.run(680)
        return c.frame.copy()
    finally:c.close()
if __name__=='__main__':
    for index in range(3):
        frame=replay(Path(sys.argv[1]),Path(sys.argv[2]),index)
        expected=['692081161813648cc2dbdd5f40541f3c87e75907fa9e0535b34ccfca86cf3ea2',
                  'c3f04b76380a1c37dc3139406206fd4f04f2be283ce6a802da265648ed4652ab',
                  'e826a1fd4097d348a32bf611f482618242f643d0e0bd102fced65004a300f9df']
        assert hashlib.sha256(frame.tobytes()).hexdigest()==expected[index]
        print('PASS menu index',index,'and game boot video fingerprint')
