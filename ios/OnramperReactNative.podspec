require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'OnramperReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'UNLICENSED', :file => '../LICENSE' }
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => "#{package['repository']}.git", :tag => "v#{s.version}" }

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # Legacy Expo-dependent Swift files (OnramperReactNativeModule.swift,
  # OnramperCheckoutButtonView.swift, Bridging/*.swift, PreparedIntentRegistry.swift)
  # are intentionally excluded during the Nitro migration. They remain in the
  # repo for reference; new Nitro implementation files (Hybrid*.swift, Nitro*.swift)
  # are added in subsequent tasks.
  s.source_files        = 'Hybrid*.swift', 'Nitro*.swift'
  s.vendored_frameworks = 'Frameworks/OnramperSDK.xcframework'

  load File.join(__dir__, '..', 'nitrogen', 'generated', 'ios', 'OnramperReactNative+autolinking.rb')
  add_nitrogen_files(s)
end
