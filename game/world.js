// Coordinates use tile centers. Markers share the collision layer with their tile.
const WORLD = {
  pod: {name:'The quiet chamber', sky:'#282438', stone:'#504758', light:'#b49bff', rows:[
    '#############',
    '#..G........#',
    '#...###.###.#',
    '#...........#',
    '#..P...C....>',
    '#...#.....#.#',
    '#...........#',
    '#############'], exits:{'>':['gallery',1,4]}},
  gallery:{name:'Relay gallery',sky:'#172e36',stone:'#37515a',light:'#76d4cd',rows:[
    '#############',
    '#...E..#..T.#',
    '#.##...#....#',
    '#......#....#',
    '<.......H...>',
    '#...##.#....#',
    '#......#....#',
    '#############'],exits:{'<':['pod',11,4],'>':['ridge',1,4]}},
  ridge:{name:'Sounding ridge',sky:'#2d2737',stone:'#625363',light:'#efb789',rows:[
    '#############',
    '#..D....#...#',
    '#....#..#...#',
    '#....#......#',
    '<........M..#',
    '#.##.....#..#',
    '#......#....#',
    '#############'],exits:{'<':['gallery',11,4]}}
};
const FOES = {
  H:{name:'Hollow picket',hp:24,power:7,period:3},
  E:{name:'Echo straggler',hp:20,power:5,period:3},
  D:{name:'Survey crawler',hp:22,power:6,period:2}
};
const TEXT = {
  G:'The Guardian lowers one enormous hand. “Chris asked me to keep this safe until you woke.” The chip carries no name for you. The sleeping Frames around you remain undisturbed.',
  C:'A service drawer still holds a legacy shoulder bearing and two field weapons. The bearing fits your chassis. The sealed core has no service interface.',
  E:'An Echo Frame at the broken rail holds up an empty hand. “I know the sound of the next door. I don’t want to cross it alone.”',
  T:'A station-made coupling lies beside the ancient socket. The contacts and tolerances differ. It cannot be fitted.',
  D:'The crawler keeps painting a survey line over the same stone. Its faded panel offers a local escort protocol. A second control challenges its perimeter lock.',
  H:'A white-armored Hollow pivots between the ruined arches. Its blank visor lights red as its targeting cycle starts.',
  M:'Mira folds her survey tripod. “I’m Mira. I lead Exploration. What name would you like me to put on the field record?”'
};
const ACTIONS = {
  G:[['listen','Listen']],C:[['fit','Fit legacy bearing'],['blade','Equip arc blade'],['lance','Equip coil lance']],
  E:[['invite','Ask to travel together'],['challenge','Challenge']],T:[['inspect','Inspect coupling']],
  D:[['escort','Request escort'],['challenge','Challenge']],H:[['fight','Engage']],
  M:[['name','Give your name'],['private','Keep your name private']]
};
if(typeof module!=='undefined') module.exports={WORLD,FOES,TEXT,ACTIONS};
