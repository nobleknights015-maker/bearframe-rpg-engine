"""Minimal offline libretro harness. Only private, optional screenshots, no ROM exports."""
import argparse
from tempfile import TemporaryDirectory
import ctypes as C
from pathlib import Path
from zipfile import ZipFile
from PIL import Image

class Region(C.Structure):
    _fields_=[("flags",C.c_uint64),("ptr",C.c_void_p)]+[(k,C.c_size_t) for k in ("offset","start","select","disconnect","length")]+[("space",C.c_char_p)]

class MemoryMap(C.Structure):
    _fields_=[("regions",C.POINTER(Region)),("count",C.c_uint)]

class GameInfo(C.Structure):
    _fields_=[('path',C.c_char_p),('data',C.c_void_p),('size',C.c_size_t),('meta',C.c_char_p)]

class Console:
    def __init__(self,core,archive):
        self.lib=C.CDLL(str(core.resolve()))
        self.callbacks=[]
        self.buttons=set()
        self.format=0
        self.frame=None
        self.capture=False
        self.path=str(Path.cwd()).encode()
        def environment(cmd,ptr):
            if cmd & 0xffff == 36 and ptr:
                maps=C.cast(ptr,C.POINTER(MemoryMap)).contents
                self.regions={r.start:(r.ptr,r.offset,r.length) for r in maps.regions[:maps.count]}
                return True
            if cmd==10:
                self.format=C.cast(ptr,C.POINTER(C.c_uint))[0]
                return self.format in (0,1,2)
            if cmd in (9,31):
                C.cast(ptr,C.POINTER(C.c_char_p))[0]=self.path
                return True
            if cmd==51:return True
            if cmd==3:
                C.cast(ptr,C.POINTER(C.c_bool))[0]=True
                return True
            return False
        def video(data,w,h,pitch):
            if self.capture and data and 0<w<4096 and 0<h<4096:
                import numpy as np
                raw=C.string_at(data,h*pitch)
                fmt='<u4' if self.format==1 else '<u2'
                pixels=np.frombuffer(raw,dtype=fmt).reshape(h,-1)[:,:w].astype('uint32')
                r,g,b=((16,255),(8,255),(0,255)) if self.format==1 else (
                    ((11,31),(5,63),(0,31)) if self.format==2 else ((10,31),(5,31),(0,31)))
                self.frame=Image.fromarray(np.stack([((pixels>>shift)&mask)*255//mask for shift,mask in (r,g,b)],-1).astype('uint8'))
        def register(name,fn,result,*types):
            callback=C.CFUNCTYPE(result,*types)(fn);self.callbacks.append(callback)
            getattr(self.lib,'retro_set_'+name)(callback)
        register('environment',environment,C.c_bool,C.c_uint,C.c_void_p)
        register('video_refresh',video,None,C.c_void_p,C.c_uint,C.c_uint,C.c_size_t)
        register('audio_sample',lambda *_:None,None,C.c_int16,C.c_int16)
        register('audio_sample_batch',lambda _,n:n,C.c_size_t,C.c_void_p,C.c_size_t)
        register('input_poll',lambda:None,None)
        register('input_state',lambda p,d,i,k:(sum(1<<v for v in self.buttons) if k==256 else int(k in self.buttons)) if p==0 else 0,C.c_int16,*([C.c_uint]*4))
        self.lib.retro_init()
        with ZipFile(archive) as z:
            name,=z.namelist()
            data=z.read(name)
        self.temp=TemporaryDirectory()
        private_path=Path(self.temp.name)/Path(name).name
        private_path.write_bytes(data)
        self.buf=C.create_string_buffer(data)
        self.info=GameInfo(str(private_path).encode(),C.cast(self.buf,C.c_void_p),len(data),None)
        self.lib.retro_load_game.restype=C.c_bool
        if not self.lib.retro_load_game(C.byref(self.info)):raise RuntimeError('Core rejected cartridge')
        self.lib.retro_set_controller_port_device(0,1)
    def run(self,n,button=None):
        self.buttons=set() if button is None else {button}
        for i in range(n):
            self.capture=i==n-1
            self.lib.retro_run()
    def close(self):
        self.lib.retro_unload_game()
        self.lib.retro_deinit()
        self.temp.cleanup()

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('core',type=Path);p.add_argument('rom_zip',type=Path)
    p.add_argument('sequence',help='Comma-separated frame counts or count:libretro_joypad_ID')
    p.add_argument('private_capture',type=Path)
    a=p.parse_args();c=Console(a.core,a.rom_zip)
    for step in a.sequence.split(','):c.run(*map(int,step.split(':')))
    c.frame.save(a.private_capture);c.close()
