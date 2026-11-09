import unittest
from cross_game_reference import ps2_weapon_damage,ps3_priority_from_rng
class CrossGameReferenceTests(unittest.TestCase):
    def test_psii_ordinary_hit(self):
        # (84 + roll + attack) * 256 / (defense*5+100), multiplied by weapon+2
        # then fixed point right shift.
        self.assertEqual(ps2_weapon_damage(100,20,5,10),6)
    def test_psii_bugfix_small_equal(self):
        self.assertEqual(ps2_weapon_damage(100,20,5,10),ps2_weapon_damage(100,20,5,10,bugfix=True))
    def test_psii_bugfix_high_damage_differs(self):
        a=ps2_weapon_damage(600,0,40,31)
        b=ps2_weapon_damage(600,0,40,31,bugfix=True)
        self.assertNotEqual(a,b)
    def test_psii_roll_range(self):
        with self.assertRaises(ValueError):ps2_weapon_damage(100,20,5,32)
    def test_psiii_preemptive(self):
        self.assertEqual(ps3_priority_from_rng(8),'preemptive')
    def test_psiii_ambush(self):
        self.assertEqual(ps3_priority_from_rng(9),'ambush')
    def test_psiii_normal(self):
        self.assertEqual(ps3_priority_from_rng(10),'normal')
    def test_psiii_special(self):
        self.assertEqual(ps3_priority_from_rng(0,special_conditions=True),'normal')
if __name__=='__main__':unittest.main()
