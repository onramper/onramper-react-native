import ExpoModulesCore

struct PreparedIntentDict: Record {
    @Field var intentHandle: String = ""
    @Field var quote: [String: Any] = [:]
}
