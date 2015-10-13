import re, sys

content = sys.stdin.read()

exports = re.findall('\nexports.(\S+)', content)

content = re.sub('\nexports.(\S+)', r'\nvar \1', content);

content = content + '\nexport {\n  %s\n}' % (',\n  '.join(exports))

print content
