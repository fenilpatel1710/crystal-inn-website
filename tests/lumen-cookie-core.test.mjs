import {test} from 'bun:test';
import {strict as assert} from 'node:assert';
import {approvedLumenOrigin,loginWasApproved,readLumenAuthCookie} from '../lib/lumen/cookie-core.ts';
const fakeCookie='CfDJ8MockCookieValue_1234567890abcdef';
test('accepts only exact approved HTTPS origin',()=>{
 assert.equal(approvedLumenOrigin('https://lumenpms.com','lumenpms.com'),'https://lumenpms.com');
 for(const bad of ['http://lumenpms.com','https://other.example','https://lumenpms.com.evil.test','https://lumenpms.com/user','https://user:pass@lumenpms.com','https://lumenpms.com/?x=1']){
  assert.throws(()=>approvedLumenOrigin(bad,'lumenpms.com'));
 }
});
test('requires true, not just HTTP success',()=>{
 assert.equal(loginWasApproved('true'),true);
 assert.equal(loginWasApproved(' true\n'),true);
 assert.equal(loginWasApproved('false'),false);
 assert.equal(loginWasApproved('{"success":true}'),false);
});
test('reads only AppCookies (case insensitive) and preserves exact name',()=>{
 const h=new Headers();
 h.append('Set-Cookie','other_session=123; Path=/');
 h.append('Set-Cookie','aPPCOOKIES='+fakeCookie+'; Path=/; Secure; HttpOnly');
 assert.deepEqual(readLumenAuthCookie(h),{name:'aPPCOOKIES',value:fakeCookie});
});
test('rejects missing, short, malformed and chunked cookie',()=>{
 for(const val of ['', 'short', 'chunks-2','abc%0D%0Ashort']){
  const h=new Headers();
  if(val)h.append('Set-Cookie','AppCookies='+val+'; Path=/');
  assert.throws(()=>readLumenAuthCookie(h));
 }
});
