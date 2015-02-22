#!/usr/bin/env python
# generate the "kitchen sink" tests

import json, random

configs = []
operators = ['$gt', '$gte', '$eq', '$ne', '$lt', '$lte']
fields = ['_id', 'rank', 'series', 'debut', 'name']

docs = [
  {'debut': 1981, 'series': 'Mario', '_id': 'mario', 'name': 'Mario', 'rank': 5}, 
  {'debut': 1996, 'series': 'Pokemon', '_id': 'puff', 'name': 'Jigglypuff', 'rank': 8}, 
  {'debut': 1986, 'series': 'Zelda', '_id': 'link', 'name': 'Link', 'rank': 10}, 
  {'debut': 1981, 'series': 'Mario', '_id': 'dk', 'name': 'Donkey Kong', 'rank': 7}, 
  {'debut': 1996, 'series': 'Pokemon', '_id': 'pikach', 'name': 'Pikach', 'rank': 1}, 
  {'debut': 1990, 'series': 'F-Zero', '_id': 'falcon', 'name': 'Captain Falcon', 'rank': 4},
  {'debut': 1983, 'series': 'Mario', '_id': 'luigi', 'name': 'Luigi', 'rank': 11}, 
  {'debut': 1993, 'series': 'Star Fox', '_id': 'fox', 'name': 'Fox', 'rank': 3}, 
  {'debut': 1994, 'series': 'Earthbound', '_id': 'ness', 'name': 'Ness', 'rank': 9}, 
  {'debut': 1986, 'series': 'Metroid', '_id': 'samus', 'name': 'Samus', 'rank': 12}, 
  {'debut': 1990, 'series': 'Mario', '_id': 'yoshi', 'name': 'Yoshi', 'rank': 6}, 
  {'debut': 1992, 'series': 'Kirby', '_id': 'kirby', 'name': 'Kirby', 'rank': 2}]

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
