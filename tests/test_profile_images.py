import base64,struct,zlib,tempfile,unittest
from pathlib import Path
from community import Community,APIError
from profile_images import clean_picture

def png(width=2,height=2,extra=b'',pixels=None):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+extra+chunk(b'IDAT',zlib.compress(pixels if pixels is not None else (b'\0'+b'\x80\x40\x90\xff'*width)*height))+chunk(b'IEND',b'')
def data_url(raw):return 'data:image/png;base64,'+base64.b64encode(raw).decode()
class PictureTests(unittest.TestCase):
    def test_validation_removes_metadata_rejects_unsafe_or_unbounded_images(self):
        kind=b'tEXt';data=b'Location\0Private metadata';extra=struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        self.assertEqual(clean_picture(data_url(png(extra=extra))),png())
        for value in ['https://tracker.example/avatar','data:image/svg+xml;base64,PHN2Zz4=',data_url(b'not png'),data_url(png(width=257)),data_url(png()+b'extra'),data_url(png(pixels=b'\0'*1000000)),data_url(png(pixels=b'\x05'+b'\0'*8+b'\0'+b'\0'*8)),data_url(png()[:-1])]:
            with self.assertRaises(APIError):clean_picture(value)
    def test_own_storage_export_and_account_deletion(self):
        with tempfile.TemporaryDirectory() as temp:
            service=Community(Path(__file__).resolve().parents[1],Path(temp)/'db.sqlite3')
            with service.db() as db:db.executemany('INSERT INTO users VALUES(?,?,?,?)',[(1,'PictureOwner','hash',1),(2,'OtherPlayer','hash',1)])
            owner={'id':1};other={'id':2};picture=data_url(png())
            with self.assertRaises(APIError):service.set_picture(None,{'image':picture})
            self.assertTrue(service.set_picture(owner,{'image':picture})['hasPicture']);self.assertEqual(service.picture(owner),png());self.assertIsNone(service.picture(other))
            self.assertEqual(service.export(owner)['profilePicture'],picture);self.assertNotIn('profilePicture',service.export(other))
            with service.db() as db:db.execute('DELETE FROM users WHERE id=1')
            self.assertIsNone(service.picture(owner))
