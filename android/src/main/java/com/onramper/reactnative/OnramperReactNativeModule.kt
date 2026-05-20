package com.onramper.reactnative

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlatformUnsupportedException :
    CodedException("Onramper React Native is iOS-only in this release.") {
    override fun getCode(): String = "platformUnsupported"
}

class OnramperReactNativeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("OnramperReactNative")
        Events("onStateChanged", "onCheckoutEvent")

        AsyncFunction("configure") { _: Map<String, Any?>, _: Any? ->
            throw PlatformUnsupportedException()
        }
        AsyncFunction("initialize") { _: String, _: String ->
            throw PlatformUnsupportedException()
        }
        AsyncFunction("getCheckoutRequirements") { _: Map<String, Any?>, _: Map<String, Any?> ->
            throw PlatformUnsupportedException()
        }
        AsyncFunction("cancelPreparedIntent") { _: String ->
            throw PlatformUnsupportedException()
        }
        AsyncFunction("reset") {
            throw PlatformUnsupportedException()
        }
    }
}
