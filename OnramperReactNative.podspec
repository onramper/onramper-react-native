require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'OnramperReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'Apache-2.0', :file => 'LICENSE' }
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { :git => "#{package['repository']}.git", :tag => "v#{s.version}" }

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # This podspec lives at the package root (not ios/) because nitrogen emits its
  # generated source globs (nitrogen/generated/**) relative to the podspec's
  # directory via add_nitrogen_files below. Our own sources are ios/-prefixed.
  # ios/OnramperStripe holds the iOS SDK's Stripe checkout module, fetched as
  # source from the same onramper-ios release as the xcframework
  # (scripts/stripe-sources.js). It compiles into this pod against OnramperSDK's
  # @_spi(OnramperNative) interface and Stripe's iOS SDK.
  s.source_files        = 'ios/*.swift', 'ios/OnramperStripe/*.swift'
  s.vendored_frameworks = 'ios/Frameworks/OnramperSDK.xcframework'

  # Stripe's iOS SDK, pinned exactly like the iOS SDK's own Package.swift: the
  # crypto onramp is a private-preview SPI whose signatures change between
  # releases. Stripe publishes this version through Swift Package Manager only
  # (CocoaPods trunk stops at 26.9.0), so it comes in through React Native's
  # spm_dependency helper, defined by the app Podfile's react_native_pods
  # require and applied by react_native_post_install.
  unless defined?(spm_dependency)
    raise 'OnramperReactNative needs React Native\'s spm_dependency helper: require react_native_pods in your Podfile and call react_native_post_install in post_install.'
  end
  spm_dependency(s,
    url: 'https://github.com/stripe/stripe-ios-spm',
    requirement: { kind: 'exactVersion', version: '26.15.1' },
    products: ['StripeCryptoOnramp', 'StripePaymentSheet', 'StripePayments']
  )

  load File.join(__dir__, 'nitrogen', 'generated', 'ios', 'OnramperReactNative+autolinking.rb')
  add_nitrogen_files(s)

  # Wires up the React Native new-architecture dependencies and header search
  # paths (React-Core, React-RCTFabric, ReactCommon, Yoga, folly, …). Required
  # because our Nitro View's generated code includes React Fabric headers, which
  # transitively include yoga/style/Style.h — without this the pod fails to
  # compile with "'yoga/style/Style.h' file not found".
  install_modules_dependencies(s)
end
