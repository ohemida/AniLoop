"""Report catalog risk tags, without claiming a visual or video content review."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def report():
    source=(ROOT/'data/pool.json').read_bytes()
    anime=json.loads(source)['anime'];labels={}
    for label in ['Nudity','Ecchi','Hentai']:
        entries=[a for a in anime if label.casefold() in {str(tag).casefold() for field in ['genres','tags','secondary'] for tag in a.get(field,[])}]
        labels[label]={'anime':len(entries),'withScreenshots':sum(bool(a.get('screenshots')) for a in entries),'withOpenings':sum(bool(a.get('opening')) for a in entries),'ids':[a['id'] for a in entries]}
    return {'scope':'Catalog metadata only; individual images, covers, portraits and video frames have not been visually classified. Tags describe anime, not proof of nudity in the selected files. An absent tag is not a safety rating.','poolSha256':hashlib.sha256(source).hexdigest(),'minimumAge':18,'ageAssurance':'Self-declaration only; no birth dates or identity documents collected. Not verified age assurance.','labels':labels}
if __name__=='__main__':
    path=ROOT/'data/content-review.json';path.write_text(json.dumps(report(),ensure_ascii=False,indent=2)+'\n');print('Wrote metadata-only content report:',path)
