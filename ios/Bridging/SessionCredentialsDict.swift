import ExpoModulesCore
import OnramperSDK

struct SessionCredentialsDict: Record {
    @Field var sessionId: String = ""
    @Field var sessionToken: String = ""

    func toSwift() -> SessionCredentials {
        SessionCredentials(sessionId: sessionId, sessionToken: sessionToken)
    }
}
