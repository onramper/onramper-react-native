require 'json'
require_relative 'onramper_spm'

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

  # Opt-in native checkout providers, from the app's Podfile:
  #   $OnramperProviders = ['stripe']   # before use_native_modules!
  # (Expo: the config plugin's `providers` option writes it.) Each provider
  # links one more onramper-ios product and compiles its bridge code
  # (#if ONRAMPER_<PROVIDER>). Without one, the app builds no provider SDK.
  providers = OnramperSPM.providers
  conditions = OnramperSPM.compilation_conditions(providers)

  # Assigned as a whole: a podspec can't read pod_target_xcconfig back.
  xcconfig = { 'DEFINES_MODULE' => 'YES' }
  xcconfig['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = (['$(inherited)'] + conditions).join(' ') unless conditions.empty?
  s.pod_target_xcconfig = xcconfig

  # This podspec lives at the package root (not ios/) because nitrogen emits its
  # generated source globs (nitrogen/generated/**) relative to the podspec's
  # directory via add_nitrogen_files below. Our own sources are ios/-prefixed.
  s.source_files = 'ios/*.swift'

  # The iOS SDK comes from its public Swift package, like in a native app:
  # `OnramperSDK` (prebuilt binary, no dependencies) plus one product per
  # provider (`OnramperStripe` brings Stripe's iOS SDK, pinned by onramper-ios).
  # Each release of this package wraps the iOS SDK release with the same number.
  # It is pinned to the commit of that onramper-ios tag (package.json
  # onramperIOS.revision, recorded and checked by scripts/verify-version.js),
  # not to the tag, so a moved tag can't change what apps build. That commit's
  # Package.swift in turn pins the binary by checksum.
  # React Native's spm_dependency helper (RN >= 0.75) records the package here;
  # react_native_post_install writes it into Pods.xcodeproj, and
  # onramper_spm.rb embeds OnramperSDK.framework into the app.
  #
  # SDK development only: ONRAMPER_IOS_PACKAGE_URL + ONRAMPER_IOS_PACKAGE_REVISION
  # point at another copy of onramper-ios (e.g. file:///path/to/onramper-ios).
  unless defined?(spm_dependency)
    raise 'OnramperReactNative needs React Native\'s spm_dependency helper: require react_native_pods in your Podfile and call react_native_post_install in post_install.'
  end
  OnramperSPM.verify_cocoapods_version!
  revision = ENV['ONRAMPER_IOS_PACKAGE_REVISION'] || package.dig('onramperIOS', 'revision')
  unless revision.is_a?(String) && revision.match?(/\A[0-9a-f]{40}\z/)
    raise 'OnramperReactNative: package.json onramperIOS.revision must be the 40-character onramper-ios commit SHA.'
  end
  spm_dependency(s,
    url: ENV.fetch('ONRAMPER_IOS_PACKAGE_URL', 'https://github.com/onramper/onramper-ios'),
    requirement: { kind: 'revision', revision: revision },
    products: OnramperSPM.products(providers)
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
