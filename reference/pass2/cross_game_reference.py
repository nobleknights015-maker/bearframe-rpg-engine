#!/usr/bin/env python3
"""Small original behavioral reference implementations.

Derived from examination of community PSII/PSIII reverse-engineering notes;
not Sega source code and not confirmed against the supplied GBA compilation.
"""

def ps2_weapon_damage(attack,defense,weapon_attack,random_roll,*,bugfix=False):
    """PSII 68000 reference calculation for a character's basic physical hit.

    Steps inferred from Character_CalcAttackDamage in a community 68000
    disassembly. `bugfix=False` simulates the stock 16-bit right shift, whereas
    `bugfix=True` performs a full 32-bit right shift used by a source option.
    Does not include elemental/status/additional battle effects.
    """
    for name,val,hi in [('attack',attack,65535),('defense',defense,65535),
                        ('weapon_attack',weapon_attack,255),('random_roll',random_roll,31)]:
        if not isinstance(val,int) or not (0<=val<=hi):raise ValueError(f'{name} out of range')
    numerator=((84+random_roll+attack)&0xffff)<<8
    denominator=5*defense+100
    quotient=numerator//denominator
    if quotient>65535:raise OverflowError('M68000 DIVU overflow')
    scaled=quotient*(weapon_attack+2)
    if bugfix:return (scaled>>8)&0xffff
    return (scaled&0xffff)>>8


def ps3_priority_from_rng(roll,*,special_conditions=False):
    """PSIII opening battle priority: initial 3-bit RNG case.

    Based on source label Battle_SetAttackPriority; prior game state may bypass
    the roll entirely via special_conditions.
    """
    if not isinstance(roll,int):raise ValueError('roll must be int')
    if special_conditions:return 'normal'
    r=roll&7
    return 'preemptive' if r==0 else 'ambush' if r==1 else 'normal'
