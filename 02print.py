print()
'''
# 수업 기본내용 부연설명
# 질문사항 기술 
'''

a,b,gob = 0,0,0 

a = 9
b = 4 
gob = a*b 
# 순서1] 출력방법  9 * 4 = 36  %기호사용출력   .format(출력대상기술)출력
print(f'{a} * {b} = {gob}')  #추천방법 
print('{a} * {b} = {gob}')  #데이터출력대신  문자열형태로 출력 맨앞쪽 f빠짐
print('{} * {} = {}'.format(a,b,gob))

# 순서2]   %기호사용출력  %d정수  %f실수  %s문자열   %c한글문자
print('- ' * 50)
print('%f * %f = %f' %(a,b,gob))  # 실수 9.000000 * 4.000000 = 36.000000
print('%x * %x = %x' %(a,b,gob))  #16진수 9 * 4 = 24
print('%o * %o = %o' %(a,b,gob))  #8진수 11 * 4 = 44
# 에러print('%b * %b = %b' %(a,b,gob))  #에러발생 ValueError: unsupported format character 'b' (0x62) at index 1

print(a,'*',b,'=', gob) #처음출력할때 나열식으로 제일 많이 사용 

























print()
print()