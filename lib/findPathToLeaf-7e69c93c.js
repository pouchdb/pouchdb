// `findPathToLeaf()` returns an array of revs that goes from the specified
// leaf rev to the root of that leaf’s branch.
//
// eg. for this rev tree:
// 1-9692 ▶ 2-37aa ▶ 3-df22 ▶ 4-6e94 ▶ 5-df4a ▶ 6-6a3a ▶ 7-57e5
//          ┃                 ┗━━━━━━▶ 5-8d8c ▶ 6-65e0
//          ┗━━━━━━▶ 3-43f6 ▶ 4-a3b4
//
// For a `targetRev` of '7-57e5', `findPathToLeaf()` would return ['7-57e5', '6-6a3a', '5-df4a']
// The `revs` arument has the same structure as what `revs_tree` has on e.g.
// the IndexedDB representation of the rev tree datastructure. Please refer to
// tests/unit/test.purge.js for examples of what these look like.
//
// This function will throw an error if:
// - The requested revision does not exist
// - The requested revision is not a leaf
function findPathToLeaf(revs, targetRev) {
  let path = [];
  const toVisit = revs.slice();

  let node;
  while ((node = toVisit.pop())) {
    const { pos, ids: tree } = node;
    const rev = `${pos}-${tree[0]}`;
    const branches = tree[2];

    // just assuming we're already working on the path up towards our desired leaf.
    path.push(rev);

    // we've reached the leaf of our dreams, so return the computed path.
    if (rev === targetRev) {
      //…unleeeeess
      if (branches.length !== 0) {
        throw new Error('The requested revision is not a leaf');
      }
      return path.reverse();
    }

    // this is based on the assumption that after we have a leaf (`branches.length == 0`), we handle the next
    // branch. this is true for all branches other than the path leading to the winning rev (which is 7-57e5 in
    // the example above. i've added a reset condition for branching nodes (`branches.length > 1`) as well.
    if (branches.length === 0 || branches.length > 1) {
      path = [];
    }

    // as a next step, we push the branches of this node to `toVisit` for visiting it during the next iteration
    for (let i = 0, len = branches.length; i < len; i++) {
      toVisit.push({ pos: pos + 1, ids: branches[i] });
    }
  }
  if (path.length === 0) {
    throw new Error('The requested revision does not exist');
  }
  return path.reverse();
}

export { findPathToLeaf as f };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZFBhdGhUb0xlYWYtN2U2OWM5M2MuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItbWVyZ2Uvc3JjL2ZpbmRQYXRoVG9MZWFmLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGBmaW5kUGF0aFRvTGVhZigpYCByZXR1cm5zIGFuIGFycmF5IG9mIHJldnMgdGhhdCBnb2VzIGZyb20gdGhlIHNwZWNpZmllZFxuLy8gbGVhZiByZXYgdG8gdGhlIHJvb3Qgb2YgdGhhdCBsZWFm4oCZcyBicmFuY2guXG4vL1xuLy8gZWcuIGZvciB0aGlzIHJldiB0cmVlOlxuLy8gMS05NjkyIOKWtiAyLTM3YWEg4pa2IDMtZGYyMiDilrYgNC02ZTk0IOKWtiA1LWRmNGEg4pa2IDYtNmEzYSDilrYgNy01N2U1XG4vLyAgICAgICAgICDilIMgICAgICAgICAgICAgICAgIOKUl+KUgeKUgeKUgeKUgeKUgeKUgeKWtiA1LThkOGMg4pa2IDYtNjVlMFxuLy8gICAgICAgICAg4pSX4pSB4pSB4pSB4pSB4pSB4pSB4pa2IDMtNDNmNiDilrYgNC1hM2I0XG4vL1xuLy8gRm9yIGEgYHRhcmdldFJldmAgb2YgJzctNTdlNScsIGBmaW5kUGF0aFRvTGVhZigpYCB3b3VsZCByZXR1cm4gWyc3LTU3ZTUnLCAnNi02YTNhJywgJzUtZGY0YSddXG4vLyBUaGUgYHJldnNgIGFydW1lbnQgaGFzIHRoZSBzYW1lIHN0cnVjdHVyZSBhcyB3aGF0IGByZXZzX3RyZWVgIGhhcyBvbiBlLmcuXG4vLyB0aGUgSW5kZXhlZERCIHJlcHJlc2VudGF0aW9uIG9mIHRoZSByZXYgdHJlZSBkYXRhc3RydWN0dXJlLiBQbGVhc2UgcmVmZXIgdG9cbi8vIHRlc3RzL3VuaXQvdGVzdC5wdXJnZS5qcyBmb3IgZXhhbXBsZXMgb2Ygd2hhdCB0aGVzZSBsb29rIGxpa2UuXG4vL1xuLy8gVGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuIGVycm9yIGlmOlxuLy8gLSBUaGUgcmVxdWVzdGVkIHJldmlzaW9uIGRvZXMgbm90IGV4aXN0XG4vLyAtIFRoZSByZXF1ZXN0ZWQgcmV2aXNpb24gaXMgbm90IGEgbGVhZlxuZnVuY3Rpb24gZmluZFBhdGhUb0xlYWYocmV2cywgdGFyZ2V0UmV2KSB7XG4gIGxldCBwYXRoID0gW107XG4gIGNvbnN0IHRvVmlzaXQgPSByZXZzLnNsaWNlKCk7XG5cbiAgbGV0IG5vZGU7XG4gIHdoaWxlICgobm9kZSA9IHRvVmlzaXQucG9wKCkpKSB7XG4gICAgY29uc3QgeyBwb3MsIGlkczogdHJlZSB9ID0gbm9kZTtcbiAgICBjb25zdCByZXYgPSBgJHtwb3N9LSR7dHJlZVswXX1gO1xuICAgIGNvbnN0IGJyYW5jaGVzID0gdHJlZVsyXTtcblxuICAgIC8vIGp1c3QgYXNzdW1pbmcgd2UncmUgYWxyZWFkeSB3b3JraW5nIG9uIHRoZSBwYXRoIHVwIHRvd2FyZHMgb3VyIGRlc2lyZWQgbGVhZi5cbiAgICBwYXRoLnB1c2gocmV2KTtcblxuICAgIC8vIHdlJ3ZlIHJlYWNoZWQgdGhlIGxlYWYgb2Ygb3VyIGRyZWFtcywgc28gcmV0dXJuIHRoZSBjb21wdXRlZCBwYXRoLlxuICAgIGlmIChyZXYgPT09IHRhcmdldFJldikge1xuICAgICAgLy/igKZ1bmxlZWVlZXNzXG4gICAgICBpZiAoYnJhbmNoZXMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIHJlcXVlc3RlZCByZXZpc2lvbiBpcyBub3QgYSBsZWFmJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGF0aC5yZXZlcnNlKCk7XG4gICAgfVxuXG4gICAgLy8gdGhpcyBpcyBiYXNlZCBvbiB0aGUgYXNzdW1wdGlvbiB0aGF0IGFmdGVyIHdlIGhhdmUgYSBsZWFmIChgYnJhbmNoZXMubGVuZ3RoID09IDBgKSwgd2UgaGFuZGxlIHRoZSBuZXh0XG4gICAgLy8gYnJhbmNoLiB0aGlzIGlzIHRydWUgZm9yIGFsbCBicmFuY2hlcyBvdGhlciB0aGFuIHRoZSBwYXRoIGxlYWRpbmcgdG8gdGhlIHdpbm5pbmcgcmV2ICh3aGljaCBpcyA3LTU3ZTUgaW5cbiAgICAvLyB0aGUgZXhhbXBsZSBhYm92ZS4gaSd2ZSBhZGRlZCBhIHJlc2V0IGNvbmRpdGlvbiBmb3IgYnJhbmNoaW5nIG5vZGVzIChgYnJhbmNoZXMubGVuZ3RoID4gMWApIGFzIHdlbGwuXG4gICAgaWYgKGJyYW5jaGVzLmxlbmd0aCA9PT0gMCB8fCBicmFuY2hlcy5sZW5ndGggPiAxKSB7XG4gICAgICBwYXRoID0gW107XG4gICAgfVxuXG4gICAgLy8gYXMgYSBuZXh0IHN0ZXAsIHdlIHB1c2ggdGhlIGJyYW5jaGVzIG9mIHRoaXMgbm9kZSB0byBgdG9WaXNpdGAgZm9yIHZpc2l0aW5nIGl0IGR1cmluZyB0aGUgbmV4dCBpdGVyYXRpb25cbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gYnJhbmNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRvVmlzaXQucHVzaCh7IHBvczogcG9zICsgMSwgaWRzOiBicmFuY2hlc1tpXSB9KTtcbiAgICB9XG4gIH1cbiAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgcmVxdWVzdGVkIHJldmlzaW9uIGRvZXMgbm90IGV4aXN0Jyk7XG4gIH1cbiAgcmV0dXJuIHBhdGgucmV2ZXJzZSgpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmaW5kUGF0aFRvTGVhZjtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsY0FBYyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7QUFDekMsRUFBRSxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsRUFBRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDL0I7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDO0FBQ1gsRUFBRSxRQUFRLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUc7QUFDakMsSUFBSSxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFDcEMsSUFBSSxNQUFNLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLElBQUksTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdCO0FBQ0E7QUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbkI7QUFDQTtBQUNBLElBQUksSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO0FBQzNCO0FBQ0EsTUFBTSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ2pDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0FBQ2hFLE9BQU87QUFDUCxNQUFNLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzVCLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUN0RCxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsS0FBSztBQUNMO0FBQ0E7QUFDQSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDekQsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkQsS0FBSztBQUNMLEdBQUc7QUFDSCxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDekIsSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7QUFDN0QsR0FBRztBQUNILEVBQUUsT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDeEI7Ozs7In0=
