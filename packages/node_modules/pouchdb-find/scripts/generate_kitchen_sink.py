#!/usr/bin/env python
# generate the "kitchen sink" tests

import json, random

configs = []
operators = ['$gt', '$gte', '$eq', '$ne', '$lt', '$lte']
fields = ['_id', 'rank', 'series', 'debut', 'name']

docs = [
  {'debut': 1981, 'series': 'mario', '_id': 'mario', 'name': 'mario', 'rank': 5},
  {'debut': 1996, 'series': 'pokemon', '_id': 'puff', 'name': 'jigglypuff', 'rank': 8},
  {'debut': 1986, 'series': 'zelda', '_id': 'link', 'name': 'link', 'rank': 10},
  {'debut': 1981, 'series': 'mario', '_id': 'dk', 'name': 'donkey kong', 'rank': 7},
  {'debut': 1996, 'series': 'pokemon', '_id': 'pikach', 'name': 'pikach', 'rank': 1},
  {'debut': 1990, 'series': 'f-zero', '_id': 'falcon', 'name': 'captain falcon', 'rank': 4},
  {'debut': 1983, 'series': 'mario', '_id': 'luigi', 'name': 'luigi', 'rank': 11},
  {'debut': 1993, 'series': 'star fox', '_id': 'fox', 'name': 'fox', 'rank': 3},
  {'debut': 1994, 'series': 'earthbound', '_id': 'ness', 'name': 'ness', 'rank': 9},
  {'debut': 1986, 'series': 'metroid', '_id': 'samus', 'name': 'samus', 'rank': 12},
  {'debut': 1990, 'series': 'mario', '_id': 'yoshi', 'name': 'yoshi', 'rank': 6},
  {'debut': 1992, 'series': 'kirby', '_id': 'kirby', 'name': 'kirby', 'rank': 2}]

def create_random_selector():
  operator = random.choice(operators)
  field = random.choice(fields)
  value = random.choice(docs)[field]
  
  return {field: {operator: value}}

for i in range(100):
  num_criteria = random.choice([1, 2, 3, 4]);
  if num_criteria == 1:
    selector = create_random_selector()
  else:
    selector = {'$and': []}
    for j in range(num_criteria):
      selector['$and'].append(create_random_selector())
  
  num_sort_fields = random.choice([0, 1, 2, 3])
  sort = []
  for j in range(num_sort_fields):
    sort.append(random.choice(fields))
  sort = list(set(sort))
  random.shuffle(sort)
  
  config = {'selector': selector}
  if (len(sort) > 0):
    config['sort'] = sort
  configs.append(config);
  
print json.dumps(configs)
