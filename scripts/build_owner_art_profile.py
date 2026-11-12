#!/usr/bin/env python3
"""Build a data-only real-art scene profile from the complete owner image import."""
import json
import pathlib
import sys

def build(folder, role_path):
    root=pathlib.Path(folder)
    pack=root/"runtime-pack"
    source=json.loads((pack/"asset-manifest.json").read_text())
    inventory=json.loads((root/"source-inventory.json").read_text())
    roles=json.loads(pathlib.Path(role_path).read_text())
    if source.get("version")!=1 or not isinstance(source.get("assets"),dict):
        raise ValueError("Invalid owner asset manifest")
    if roles.get("version")!=1 or roles.get("tileSize")!=32:
        raise ValueError("Only version 1 and native 32x32 terrain supported")
    if set(roles)-{"version","tileSize","tiles","sprites","eventSprites","clearColor"}:
        raise ValueError("Unknown art role metadata")
    records={}
    for record in inventory["source_entries"]:
        key=(record["source_archive"],record.get("nested_zip"),record["original_path"])
        if key in records:raise ValueError("Duplicate source identity")
        records[key]=record
    all_assets=source["assets"]
    required=set()
    def frame(ref,context,is_tile=False):
        if not isinstance(ref,dict) or set(ref)-{"source_archive","nested_zip","original_path","x","y","w","h"}:
            raise ValueError("Invalid source frame "+context)
        if not all(isinstance(ref.get(k),str) and ref[k] for k in ("source_archive","original_path")):
            raise ValueError("Missing asset identity "+context)
        key=(ref["source_archive"],ref.get("nested_zip"),ref["original_path"])
        item=records.get(key)
        if not item or not item.get("runtime_id"):
            raise ValueError("Unknown raster source "+context)
        ident=item["runtime_id"]
        desc=all_assets.get(ident)
        if not desc or desc.get("type")!="image":
            raise ValueError("Manifest mismatch "+context)
        width,height=desc["width"],desc["height"]
        x,y,w,h=ref.get("x",0),ref.get("y",0),ref.get("w",width),ref.get("h",height)
        if not all(type(n) is int for n in (x,y,w,h)) or min(x,y)<0 or min(w,h)<1 or x+w>width or y+h>height:
            raise ValueError("Source frame outside asset "+context)
        if is_tile and (w,h)!=(32,32):
            raise ValueError("Tile role must use native 32x32 source "+context)
        required.add(ident)
        return {"atlas":ident,"x":x,"y":y,"w":w,"h":h}
    tiles=roles.get("tiles")
    sprites=roles.get("sprites")
    if not isinstance(tiles,dict) or not all(k in tiles for k in ("floor","wall")) or len(tiles)>128:
        raise ValueError("Both floor and wall tile roles required")
    if not isinstance(sprites,dict) or "player" not in sprites or len(sprites)>64:
        raise ValueError("Player sprite role required")
    def valid_name(name):
        return isinstance(name,str) and bool(name) and name.isascii() and name.replace("_","").isalnum()
    if any(not valid_name(k) for k in tiles):
        raise ValueError("Invalid tile role name")
    scene_tiles={name:frame(ref,"tiles."+name,True) for name,ref in tiles.items()}
    scene_sprites={}
    for name,animation in sprites.items():
        if not valid_name(name) or not isinstance(animation,dict) or set(animation)!={"ticksPerFrame","frames"}:
            raise ValueError("Invalid sprite role "+str(name))
        ticks,frames=animation["ticksPerFrame"],animation["frames"]
        if type(ticks) is not int or not 1<=ticks<=1000 or not isinstance(frames,list) or not 1<=len(frames)<=128:
            raise ValueError("Invalid animation timing "+name)
        scene_sprites[name]={"ticksPerFrame":ticks,
                             "frames":[frame(ref,"sprite."+name) for ref in frames]}
    events=roles.get("eventSprites",{})
    if not isinstance(events,dict) or len(events)>64 or any(
            not valid_name(k) or not isinstance(v,str) or v not in scene_sprites for k,v in events.items()):
        raise ValueError("Invalid event sprite mapping")
    color=roles.get("clearColor","#101018")
    if not isinstance(color,str) or len(color)!=7 or color[0]!="#" or any(
            digit not in "0123456789abcdefABCDEF" for digit in color[1:]):
        raise ValueError("Invalid clear color")
    registered={}
    for ident,desc in sorted(all_assets.items()):
        if desc.get("type")!="image":
            raise ValueError("Owner archive import is image-only")
        registered[ident]={**desc,"path":"enginehost/packs/active/"+desc["path"],"preload":False}
    theme={"tileSize":32,"clearColor":color,
           "atlases":{ident:{"width":all_assets[ident]["width"],"height":all_assets[ident]["height"]}
                      for ident in sorted(required)},
           "tiles":scene_tiles,"sprites":scene_sprites,"eventSprites":events}
    output={"version":1,"manifest":{"version":1,"assets":registered},
            "theme":theme,"requiredImages":sorted(required)}
    # Refuse overwrite; a rejected mapping must never rewrite working art data.
    with (root/"art-profile.json").open("x",encoding="utf-8") as f:
        json.dump(output,f,ensure_ascii=True,separators=(",",":"))
        f.write("\n")
    return {"totalImages":len(registered),"sceneImages":len(required)}

if __name__=="__main__":
    if len(sys.argv)!=3:
        sys.exit("Usage: python3 scripts/build_owner_art_profile.py OWNER_IMPORT_DIR ROLES.json")
    try:
        print(json.dumps(build(sys.argv[1],sys.argv[2]),indent=2))
    except (OSError,ValueError,TypeError,KeyError) as exc:
        print("Owner art profile refused: "+str(exc),file=sys.stderr)
        sys.exit(1)
