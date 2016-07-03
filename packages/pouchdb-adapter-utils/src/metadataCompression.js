// Functions for inflating/deflating document metadata before/after storage.
//
// When storing document metadata, the most common type of object is a document
// with a single revision. This is heavily used, e.g. in the case of
// persistent map/reduce. These two functions serve to trim down the metadata
// object before storage, both to reduce size on disk and to improve performance
// by avoiding serializing and deserializing unnecessarily large JSON objects.
//
// Here's how it works. Consider this JSON object:
//
//  {
//    "id": "foo",
//    "rev_tree": [
//    {
//      "pos": 1,
//      "ids": [
//        "xxx",
//        {
//          "status": "available"
//        },
//        []
//      ]
//    }
//  ],
//    "rev": "1-xxx",
//    "rev_map": {
//    "1-xxx": 1
//  },
//    "winningRev": "1-xxx",
//    "deleted": false,
//    "seq": 1
//  }
//
// Almost everything here is pure waste. This can be simplified as:
//
//  {
//    "id": "foo",
//    "rev": "1-81fbf8fbee50fd8da15be4d38750f396",
//    "seq": 1185
//  }
//
// And the rest can be inferred

function inflateMetadata(metadata) {
  if (!metadata.rev_tree) {
    // first generation, exactly one revision in tree
    var revMap = {};
    revMap[metadata.rev] = metadata.seq;
    return {
      id: metadata.id,
      rev_tree: [
        {
          pos: 1,
          ids: [
            metadata.rev.replace(/^\d+-/, ''),
            { status: 'available'},
            []
          ]
        }
      ],
      rev: metadata.rev,
      rev_map: revMap,
      winningRev: metadata.rev,
      deleted: !!metadata.deleted,
      seq: metadata.seq
    };
  }
  return metadata;
}

function deflateMetadata(metadata) {
  if (/^1-/.test(metadata.rev) && Object.keys(metadata.rev_map).length === 1) {
    // first generation, exactly one revision in tree
    var deflatedMetadata = {
      id: metadata.id,
      rev: metadata.rev,
      seq: metadata.seq
    };
    if (metadata.deleted) {
      deflatedMetadata.deleted = true;
    }
    return deflatedMetadata;
  }
  return metadata;
}

export {
  inflateMetadata,
  deflateMetadata
};