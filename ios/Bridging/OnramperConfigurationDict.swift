import ExpoModulesCore
import OnramperSDK

struct OnramperConfigurationDict: Record {
    @Field var apiKey: String = ""
    @Field var clientId: String = ""
    @Field var environment: String = "production"
    @Field var theme: String = "system"
    @Field var logLevel: String = "off"

    func toSwift(
        sessionExpirationHandler: @Sendable @escaping () async throws -> SessionCredentials
    ) -> OnramperConfiguration {
        let env: OnramperConfiguration.Environment = environment == "development" ? .development : .production
        let resolvedTheme: OnramperConfiguration.Theme = {
            switch self.theme {
            case "light": return .light
            case "dark": return .dark
            default: return .system
            }
        }()
        let level: LogLevel = {
            switch logLevel {
            case "error": return .error
            case "info": return .info
            case "debug": return .debug
            default: return .off
            }
        }()
        return OnramperConfiguration(
            apiKey: apiKey,
            clientId: clientId,
            environment: env,
            theme: resolvedTheme,
            logLevel: level,
            sessionExpirationHandler: sessionExpirationHandler
        )
    }
}
