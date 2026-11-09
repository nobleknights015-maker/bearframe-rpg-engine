import unittest,struct
from analyze_roms import entropy, gba, genesis
class AnalyzerTests(unittest.TestCase):
 def test_entropy(self):
  self.assertEqual(entropy(bytes(200)),0)
  self.assertAlmostEqual(entropy(bytes(range(256))),8)
 def test_gba_branch_and_checksum(self):
  b=bytearray(512); struct.pack_into('<I',b,0,0xea00002e) # branch from ROM+0 to ROM+0xC0
  b[0xa0:0xac]=b'TESTGAME1234';b[0xbd]=(-sum(b[0xa0:0xbd])-0x19)&255
  h=gba(b)['header'];self.assertEqual(h['entry_target_offset_hex'],'0xC0');self.assertTrue(h['checksum_matches'])
 def test_genesis_checksum(self):
  b=bytearray(1024);b[0x100:0x10c]=b'SEGA GENESIS';struct.pack_into('>I',b,4,0x220)
  b[0x200:0x204]=b'\x12\x34\x56\x78';struct.pack_into('>H',b,0x18e,0x68ac)
  self.assertTrue(genesis(b)['header']['checksum_matches']);self.assertEqual(genesis(b)['vectors'][1]['address_hex'],'0x00000220')
if __name__=='__main__':unittest.main()
