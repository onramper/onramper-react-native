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

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files        = '*.{h,m,mm,swift,hpp,cpp}', 'Bridging/**/*.{h,m,mm,swift,hpp,cpp}'
  s.vendored_frameworks = 'Frameworks/OnramperSDK.xcframework'
end
