import sys,re

content = sys.stdin.read()
print re.sub('(\S+),', r'\1: \1,', content)
