package dev.bearframe.ridge;

import org.json.JSONObject;

/** Strict native validator for user-selected historical Expedition v1 backups.
 * Frozen geometry and schema mirror game/world.js and game/engine.js restore().
 * Supports restoration ONLY to an absent original preference; never migration
 * into an incompatible gameplay project or execution of imported code.
 */
public final class LegacyV1Validator {
    private static final String[] POD={
        "#############","#..G........#","#...###.###.#","#...........#",
        "#..P...C....>","#...#.....#.#","#...........#","#############"};
    private static final String[] GALLERY={
        "#############","#...E..#..T.#","#.##...#....#","#......#....#",
        "<.......H...>","#...##.#....#","#......#....#","#############"};
    private static final String[] RIDGE={
        "#############","#..D....#...#","#....#..#...#","#....#......#",
        "<........M..#","#.##.....#..#","#......#....#","#############"};
    private static final String[] FLAGS={"bearing","E","D","H","echoAlly","gridAlly","met"};
    private static final String[] FIELDS={"v","name","finish","area","x","y",
        "hp","charge","weapon","flags","battle","prompt","message"};
    private static boolean matches(String v,String... values){
        for(String value:values)if(value.equals(v))return true;
        return false;
    }
    private static boolean integer(Object item,long min,long max){
        if(!(item instanceof Number))return false;
        double number=((Number)item).doubleValue();
        return Double.isFinite(number)&&number>=min&&number<=max&&
            number==Math.floor(number);
    }
    private static boolean hasOnly(JSONObject o,String[] expected){
        if(o==null||o.length()!=expected.length)return false;
        for(String key:expected)if(!o.has(key))return false;
        return true;
    }
    public static boolean accepts(String raw){
        if(raw==null||raw.length()<2||raw.length()>1900000)return false;
        try {
            JSONObject s=new JSONObject(raw);
            if(!hasOnly(s,FIELDS)||!integer(s.get("v"),1,1)||
               !(s.get("name") instanceof String)||
               ((String)s.get("name")).trim().length()==0||
               ((String)s.get("name")).length()>18||
               !(s.get("finish") instanceof String)||
               !matches(s.getString("finish"),"Ash","Slate","Ivory")||
               !(s.get("area") instanceof String))return false;
            String area=s.getString("area");
            String[] rows=matches(area,"pod")?POD:
                matches(area,"gallery")?GALLERY:
                matches(area,"ridge")?RIDGE:null;
            if(rows==null||!integer(s.get("x"),0,12)||
               !integer(s.get("y"),0,7))return false;
            int x=s.getInt("x"),y=s.getInt("y");
            if(rows[y].charAt(x)=='#')return false;
            JSONObject flags=s.getJSONObject("flags");
            if(!hasOnly(flags,FLAGS))return false;
            for(String f:FLAGS)if(!(flags.get(f) instanceof Boolean))return false;
            if(flags.getBoolean("echoAlly")&&!flags.getBoolean("E")||
               flags.getBoolean("gridAlly")&&!flags.getBoolean("D"))return false;
            int maxHp=flags.getBoolean("bearing")?36:30;
            if(!integer(s.get("hp"),1,maxHp)||!integer(s.get("charge"),0,3))return false;
            if(!s.isNull("weapon")&&(!(s.get("weapon") instanceof String)||
               !matches(s.getString("weapon"),"blade","lance")))return false;
            if(!(s.get("message") instanceof String)||
               s.getString("message").length()>1000)return false;
            if(!s.isNull("prompt")&&(!(s.get("prompt") instanceof String)||
               !matches(s.getString("prompt"),"G","C","E","T","D","H","M")))
               return false;
            if(!s.isNull("battle")){
                if(!s.isNull("prompt"))return false;
                JSONObject b=s.getJSONObject("battle");
                if(!hasOnly(b,new String[]{"key","hp","turn"})||
                   !(b.get("key") instanceof String))return false;
                String foe=b.getString("key");
                int hp=matches(foe,"H")?24:matches(foe,"E")?20:
                    matches(foe,"D")?22:0;
                if(hp==0||!integer(b.get("hp"),1,hp)||
                   !integer(b.get("turn"),1,9007199254740991L))return false;
            }
            return true;
        }catch(Exception invalid){return false;}
    }
    private LegacyV1Validator(){}
}
