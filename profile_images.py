"""Validate bounded PNG pixels and discard metadata. No content moderation claim."""
import base64,binascii,struct,zlib
from community import APIError

def clean_picture(value):
    if not isinstance(value,str) or not value.startswith('data:image/png;base64,') or len(value)>470000:
        raise APIError('Upload a PNG profile picture prepared by AniLoop.')
    try:
        raw=base64.b64decode(value.split(',',1)[1],validate=True)
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError()
        pos=8;header=None;compressed=bytearray();ended=False
        while pos<len(raw):
            if pos+12>len(raw):raise ValueError()
            size=struct.unpack('>I',raw[pos:pos+4])[0];kind=raw[pos+4:pos+8]
            if pos+size+12>len(raw):raise ValueError()
            data=raw[pos+8:pos+8+size];crc=struct.unpack('>I',raw[pos+8+size:pos+12+size])[0]
            if zlib.crc32(kind+data)&0xffffffff!=crc:raise ValueError()
            if kind==b'IHDR':
                if header is not None or pos!=8 or size!=13:raise ValueError()
                w,h,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',data)
                if not (1<=w<=256 and 1<=h<=256) or depth!=8 or color not in (2,6) or any((compression,filtering,interlace)):raise ValueError()
                header=data
            elif header is None:raise ValueError()
            elif kind==b'IDAT':compressed.extend(data)
            elif kind==b'IEND':
                if size or pos+12!=len(raw):raise ValueError()
                ended=True
            elif not kind[0]&32:raise ValueError() # Unknown critical chunk or animation.
            pos+=size+12
        if not header or not ended or not compressed:raise ValueError()
        stride=w*(4 if color==6 else 3)+1;expected=stride*h
        decoder=zlib.decompressobj();pixels=decoder.decompress(compressed,expected+1)
        if len(pixels)!=expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:raise ValueError()
        if any(pixels[i]>4 for i in range(0,expected,stride)):raise ValueError()
        def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        return raw[:8]+chunk(b'IHDR',header)+chunk(b'IDAT',bytes(compressed))+chunk(b'IEND',b'')
    except (ValueError,binascii.Error,struct.error,zlib.error):
        raise APIError('Invalid profile picture. Choose another image.')
