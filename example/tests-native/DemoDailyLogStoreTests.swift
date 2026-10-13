import Foundation

@main
struct DemoDailyLogStoreTests {
  static func main() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let parse = ISO8601DateFormatter()
    let first = parse.date(from: "2026-10-13T23:59:59Z")!
    var clock = first
    let metadata = ["appVersion": "1.0", "build": "7", "ios": "27.0", "device": "iPhone15,3"]
    let directory = root.appendingPathComponent("daily")
    let store = DemoDailyLogStore(directory: directory, metadata: metadata, now: { clock })
    func record(_ date: Date, _ message: String) -> String {
      String(data: try! JSONSerialization.data(withJSONObject: [
        "timestamp": date.timeIntervalSince1970 * 1000, "level": "info",
        "category": "Client", "message": message
      ]), encoding: .utf8)!
    }
    func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
      guard try condition() else { throw NSError(domain: "LogStoreTest", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    }
    let day1 = "onramper-sdk-2026-10-13.log"
    let day2 = "onramper-sdk-2026-10-14.log"
    try check(store.files().isEmpty, "Browsing empty logs must not invent a launch record")
    store.appendRecord(record(first, "first 😀"))
    _ = store.files() // Flush the serial append queue.
    clock = first.addingTimeInterval(2)
    store.appendRecord(record(clock, "second café"))
    store.appendRecord(record(clock, "third\nnew line"))
    let names = store.files().compactMap { $0["name"] as? String }
    try check(names == [day2, day1], "UTC rollover or newest-first ordering failed")
    let old = try store.readFile(day1)
    try check(old.contains("app.launch appVersion=1.0 build=7 device=iPhone15,3 ios=27.0"), "Missing launch metadata")
    try check(old.contains("2026-10-13T23:59:59.000Z INFO Client first 😀"), "Wrong text format")
    try check(!store.readFile(day2).contains("app.launch"), "Launch header duplicated")
    try check(store.readFile(day2).contains("third\\nnew line"), "Multiline record was not escaped")

    let snapshot = try store.snapshotForFile(day1)
    defer { try? FileManager.default.removeItem(at: snapshot.deletingLastPathComponent()) }
    try check(snapshot.lastPathComponent == day1, "Export lost the date filename")
    try store.clearLogs()
    try check(store.files().isEmpty, "Clear failed")
    try check(String(contentsOf: snapshot, encoding: .utf8) == old, "Snapshot changed after deleting logs")
    do { _ = try store.readFile("../outside.log"); fatalError("Accepted traversal") } catch {}
    do { _ = try store.snapshotForFile(day1); fatalError("Exported missing file") } catch {}

    // Exactly one header per launch, including a fresh process appending today.
    store.appendRecord(record(clock, "after delete"))
    _ = store.files()
    let reopened = DemoDailyLogStore(directory: directory, metadata: metadata, now: { clock })
    reopened.appendRecord(record(clock, "new launch"))
    let reopenedText = try reopened.readFile(day2)
    try check(reopenedText.components(separatedBy: "app.launch").count - 1 == 2, "Missing header after relaunch")

    // Cleanup happens on reads, even if recording has been turned off.
    let stale = directory.appendingPathComponent(day1)
    try Data("old\n".utf8).write(to: stale)
    try FileManager.default.setAttributes([.modificationDate: clock.addingTimeInterval(-8 * 86400)], ofItemAtPath: stale.path)
    try check(reopened.files().count == 1, "Expired file not pruned")
    let unrelated = directory.appendingPathComponent("keep.txt")
    try Data("keep".utf8).write(to: unrelated)
    try reopened.clearLogs()
    try check(FileManager.default.fileExists(atPath: unrelated.path), "Deleted a non-log file")

    let bounded = DemoDailyLogStore(directory: root.appendingPathComponent("bounded"), metadata: metadata, maxTotalBytes: 2048, now: { clock })
    bounded.appendRecord(record(first, String(repeating: "a", count: 700)))
    for index in 0..<20 { bounded.appendRecord(record(clock, "record-\(index) " + String(repeating: "😀", count: 100))) }
    let boundedFiles = bounded.files()
    try check(boundedFiles.reduce(0) { $0 + ($1["sizeBytes"] as? Int ?? 0) } <= 2048, "Size cap exceeded")
    try check(boundedFiles.count == 1, "Oldest day not removed first")
    let tail = try bounded.readFile(day2)
    try check(tail.contains("record-19") && !tail.contains("record-0 "), "Size trimming lost newest records")
    try check(!tail.contains("�") && tail.contains("older entries removed"), "Bad UTF-8 or missing trim notice")

    let preview = DemoDailyLogStore(directory: root.appendingPathComponent("preview"), metadata: metadata, now: { clock })
    for index in 0..<600 { preview.appendRecord(record(clock, "line-\(index) " + String(repeating: "é", count: 200))) }
    let text = try preview.readFile(day2)
    try check(text.contains("showing the last 200 KB") && text.contains("line-599"), "Preview not bounded to recent records")
    try check(!text.contains("�") && !text.contains("line-0 "), "Preview cut a UTF-8 character or kept oldest lines")
    let before = preview.files()
    preview.appendRecord("not json")
    preview.appendRecord(String(repeating: "a", count: 70_000))
    try check((preview.files()[0]["sizeBytes"] as? Int) == (before[0]["sizeBytes"] as? Int), "Malformed/oversized record was persisted")
    print("PASS: UTC rollover, metadata, text formatting, export snapshot, path validation, clear/relaunch, age/size retention and UTF-8 preview")
  }
}
