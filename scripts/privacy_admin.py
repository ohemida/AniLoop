"""Local operator-only maintenance and minimal privacy-request tracking. No network calls."""
from pathlib import Path
import argparse,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from community import Community
from retention import Maintenance
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--database',type=Path,default=ROOT/'.runtime/community.sqlite3')
    sub=parser.add_subparsers(dest='command',required=True);sub.add_parser('cleanup');sub.add_parser('backup');sub.add_parser('list')
    create=sub.add_parser('open');create.add_argument('type',choices=['access','correction','deletion','restriction','portability','objection','incident']);create.add_argument('reference',help='Internal reference only, never credentials')
    close=sub.add_parser('close');close.add_argument('id');args=parser.parse_args()
    if not args.database.is_file():parser.error('Database must already exist; refusing to create an accidental new account store.')
    service=Community(ROOT,args.database);maintenance=Maintenance(service,backups=args.command=='backup')
    try:
        if args.command in {'cleanup','backup'}:result=maintenance.run()
        elif args.command=='open':result=maintenance.open_case(args.type,args.reference)
        elif args.command=='close':maintenance.close_case(args.id);result={'closed':args.id}
        else:
            with service.db() as db:result=[dict(row) for row in db.execute('SELECT * FROM privacy_cases ORDER BY opened DESC')]
        print(json.dumps(result,indent=2))
    except ValueError as error:parser.error(str(error))
