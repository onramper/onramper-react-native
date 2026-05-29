require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'OnramperReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'UNLICENSED' }
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => "#{package['repository']}.git", :tag => "v#{s.version}" }

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # This podspec lives at the package root (not ios/) because nitrogen emits its
  # generated source globs (nitrogen/generated/**) relative to the podspec's
  # directory via add_nitrogen_files below. Paths to our own sources are therefore
  # ios/-prefixed.
  #
  # Legacy Expo-dependent Swift files (ios/OnramperReactNativeModule.swift,
  # ios/OnramperCheckoutButtonView.swift, ios/Bridging/*.swift,
  # ios/PreparedIntentRegistry.swift) are intentionally excluded during the Nitro
  # migration. They remain in the repo for reference; new Nitro implementation
  # files (ios/Hybrid*.swift, ios/Nitro*.swift) are compiled.
  s.source_files        = 'ios/Hybrid*.swift', 'ios/OnramperSDKBridge.swift'
  s.vendored_frameworks = 'ios/Frameworks/OnramperSDK.xcframework'

  load File.join(__dir__, 'nitrogen', 'generated', 'ios', 'OnramperReactNative+autolinking.rb')
  add_nitrogen_files(s)

  # Wires up the React Native new-architecture dependencies and header search
  # paths (React-Core, React-RCTFabric, ReactCommon, Yoga, folly, …). Required
  # because our Nitro View's generated code includes React Fabric headers, which
  # transitively include yoga/style/Style.h — without this the pod fails to
  # compile with "'yoga/style/Style.h' file not found".
  install_modules_dependencies(s)
end
