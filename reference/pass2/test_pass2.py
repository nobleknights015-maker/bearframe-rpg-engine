import unittest
import os
from pathlib import Path
from reverse_pass2 import read_rom,extract_psiv,FlagBank,EncounterState,sum_sram_bytes,gba_entry
ROM=Path(os.environ.get('PSIV_ROM_ARCHIVE',str(Path(__file__).resolve().parent.parent/'Phantasy Star IV.zip')))
class ReverseEngineeringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not ROM.exists(): raise unittest.SkipTest('Provide PSIV_ROM_ARCHIVE to run ROM-anchored tests')
        cls.r=extract_psiv(read_rom(ROM))
    def test_main_dispatch(self):
        v=self.r['dispatchers']['main']['states']
        self.assertEqual(len(v),7)
        self.assertEqual(v[3]['entry_rom_address_hex'],'0x05199A')
        self.assertEqual(v[5]['entry_rom_address_hex'],'0x00093A')
    def test_field_dispatch(self):
        v=self.r['dispatchers']['field']['states']
        self.assertEqual(len(v),10)
        self.assertEqual(v[0]['entry_rom_address_hex'],'0x05770E')
        self.assertEqual(v[2]['entry_rom_address_hex'],'0x0587C2')
    def test_battle_dispatch(self):
        v=self.r['dispatchers']['battle']['states']
        self.assertEqual(len(v),18)
        self.assertEqual(v[4]['entry_rom_address_hex'],'0x0053E2')
        self.assertEqual(v[7]['entry_rom_address_hex'],'0x0054CC')
    def test_flags_msb(self):
        b=FlagBank();b.set(0);b.set(7);b.set(8);b.set(255)
        self.assertEqual(b.bits[0],0x81);self.assertEqual(b.bits[1],0x80)
        self.assertEqual(b.bits[31],0x01)
    def test_flags_clear_and_mask(self):
        b=FlagBank();b.set(257);self.assertTrue(b.check(1));b.clear(1)
        self.assertFalse(b.check(257))
    def test_encounter_start_after_ten_moves(self):
        s=EncounterState()
        for i in range(9):self.assertFalse(s.finished_move(0))
        self.assertTrue(s.finished_move(0))
    def test_encounter_masks(self):
        f=EncounterState(timer=1)
        self.assertTrue(f.finished_move(32))
        self.assertFalse(f.finished_move(31))
        self.assertFalse(f.finished_move(32,vehicle=True))
        self.assertTrue(f.finished_move(128,vehicle=True))
    def test_encounter_blocked_and_reset(self):
        f=EncounterState(timer=1)
        self.assertFalse(f.finished_move(0,blocked_event=True))
        self.assertFalse(f.finished_move(0,transition_tile=True))
        self.assertFalse(f.finished_move(0,enabled=False))
        f.new_map();self.assertEqual(f.timer,10)
    def test_checksum(self):
        b=bytes([255])*0xA00
        self.assertEqual(sum_sram_bytes(b),(255*0xA00)&0xffff)
    def test_checksum_size_rejected(self):
        with self.assertRaises(ValueError):sum_sram_bytes(bytes(100))
    def test_gba_branch(self):
        self.assertEqual(gba_entry(bytes.fromhex('2e0000ea')),0xC0)
    def test_gba_other_rejected(self):
        with self.assertRaises(ValueError):gba_entry(bytes.fromhex('00000000'))
if __name__=='__main__':unittest.main()
