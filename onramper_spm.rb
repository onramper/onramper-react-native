# CocoaPods support for consuming the Onramper iOS SDK through Swift Package
# Manager. Loaded by OnramperReactNative.podspec (require_relative).
#
# The podspec declares the onramper-ios package with React Native's
# `spm_dependency` helper (React Native >= 0.75), which `react_native_post_install`
# writes into Pods.xcodeproj. This file covers what that helper doesn't:
#
# 1. Embedding. OnramperSDK is a dynamic binary framework. Xcode only embeds
#    package frameworks into the app for targets that link them directly; one
#    linked by a pod target is invisible to both Xcode's embedding and
#    CocoaPods' "[CP] Embed Pods Frameworks" phase. Without the build phase
#    added here the app builds and then crashes at launch with
#    "dyld: Library not loaded: @rpath/OnramperSDK.framework/OnramperSDK".
#    The phase is added to every application target that links our pod, and
#    removed from application targets that no longer do.
#
# 2. A UUID-counter guard for Pods.xcodeproj. React Native 0.75–0.87 can mint
#    a UUID that collides with an existing object when it writes the Swift
#    package references (fixed upstream in facebook/react-native#57576, RN
#    0.88). The guard raises CocoaPods' counter past every existing UUID before
#    the post_install hooks run, and an integrity check refuses to save a
#    corrupted project.
#
# @stripe/stripe-react-native's stripe_spm.rb does the same for Stripe's
# frameworks. Both guards are idempotent, so they compose when both packages
# are installed. Everything here is idempotent: CocoaPods may evaluate the
# podspec more than once.

module OnramperSPM
  POD_NAME = 'OnramperReactNative'.freeze

  # post_integrate hooks, which the embed phase runs from, exist since 1.10.
  MINIMUM_COCOAPODS_VERSION = '1.10'.freeze

  # Native checkout providers that ship as separate onramper-ios products.
  # Each is opt-in, because each adds the provider's own SDK to the app.
  PROVIDERS = {
    'stripe' => { product: 'OnramperStripe', condition: 'ONRAMPER_STRIPE' },
  }.freeze

  PHASE_NAME = '[onramper-react-native] Embed OnramperSDK'.freeze

  # Copies OnramperSDK.framework from wherever Xcode built it (regular builds:
  # BUILT_PRODUCTS_DIR or PackageFrameworks; Archive builds:
  # UninstalledProducts) into the app's Frameworks folder and re-signs it.
  # Skips a statically linked copy, which is already inside its consumers.
  # When our pod isn't part of the build any more (the package was removed and
  # this phase left behind), it only warns, so a stale phase can't break the
  # build.
  SCRIPT = <<~'SCRIPT'.freeze
    set -e
    [ -n "${TARGET_BUILD_DIR:-}" ] && [ -n "${FRAMEWORKS_FOLDER_PATH:-}" ] || exit 0
    DEST="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"
    for DIR in "${BUILT_PRODUCTS_DIR}" "${BUILT_PRODUCTS_DIR}/PackageFrameworks" "${OBJROOT}/UninstalledProducts/${PLATFORM_NAME}"; do
      FRAMEWORK="$DIR/OnramperSDK.framework"
      [ -f "$FRAMEWORK/OnramperSDK" ] || continue
      file -b "$FRAMEWORK/OnramperSDK" | grep -q "dynamically linked" || continue
      mkdir -p "$DEST"
      # No trailing slash on the source: --delete stays inside this framework.
      rsync -a --delete --exclude Headers --exclude PrivateHeaders --exclude Modules "$FRAMEWORK" "$DEST/"
      if [ -n "${EXPANDED_CODE_SIGN_IDENTITY:-}" ] && [ "${CODE_SIGNING_ALLOWED:-NO}" = "YES" ]; then
        codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" --preserve-metadata=identifier,entitlements "$DEST/OnramperSDK.framework"
      fi
      exit 0
    done
    if [ -n "${PODS_CONFIGURATION_BUILD_DIR:-}" ] && [ ! -d "${PODS_CONFIGURATION_BUILD_DIR}/OnramperReactNative" ]; then
      echo "warning: [onramper-react-native] OnramperReactNative isn't part of this build; if you removed @onramper/onramper-react-native, delete the \"${SCRIPT_PHASE_NAME:-Embed OnramperSDK}\" build phase"
      exit 0
    fi
    echo "error: [onramper-react-native] OnramperSDK.framework not found in build products. Make sure the Podfile's post_install calls react_native_post_install, then run pod install again" >&2
    exit 1
  SCRIPT

  class << self
    # The providers the app opted in to, from the Podfile
    # (`$OnramperProviders = ['stripe']`, set before `use_native_modules!` /
    # `use_expo_modules!`) or, when that is unset, the ONRAMPER_PROVIDERS
    # environment variable (comma-separated). Unknown names fail the install.
    def providers
      raw = if defined?($OnramperProviders) && !$OnramperProviders.nil?
              $OnramperProviders
            else
              ENV.fetch('ONRAMPER_PROVIDERS', '').split(',')
            end
      names = Array(raw).map { |p| p.to_s.strip.downcase }.reject(&:empty?).uniq
      unknown = names - PROVIDERS.keys
      unless unknown.empty?
        raise Pod::PlainInformative,
              "[onramper-react-native] Unknown provider(s) in $OnramperProviders: #{unknown.join(', ')}. " \
              "Supported: #{PROVIDERS.keys.join(', ')}"
      end
      names
    end

    def products(providers)
      ['OnramperSDK'] + providers.map { |p| PROVIDERS.fetch(p)[:product] }
    end

    def compilation_conditions(providers)
      providers.map { |p| PROVIDERS.fetch(p)[:condition] }
    end

    def verify_cocoapods_version!
      return unless defined?(Pod::VERSION) && Gem::Version.correct?(Pod::VERSION)
      return if Gem::Version.new(Pod::VERSION) >= Gem::Version.new(MINIMUM_COCOAPODS_VERSION)

      raise Pod::PlainInformative,
            "[onramper-react-native] needs CocoaPods #{MINIMUM_COCOAPODS_VERSION} or newer, " \
            "but this install runs #{Pod::VERSION}. Update CocoaPods (with a Gemfile: bundle exec pod install)"
    end

    def ensure_uuid_counter_safe(installer)
      project = installer.pods_project
      return unless project

      prefix = project.instance_variable_get(:@uuid_prefix)
      return unless prefix.is_a?(String) && prefix.length >= 6

      counter_prefix = prefix[0, 6]
      max_index = -1
      project.objects_by_uuid.each_key do |uuid|
        # Counter-format UUIDs only: 6-char prefix + 7 hex digits + '0'.
        next unless uuid.is_a?(String) && uuid.length == 14 &&
                    uuid.start_with?(counter_prefix) && uuid.end_with?('0')

        index = uuid[6, 7].to_i(16)
        max_index = index if index > max_index
      end
      return if max_index < 0

      generated = project.instance_variable_get(:@generated_uuids)
      generated = [] unless generated.is_a?(Array)
      generated << format('%.6s%07X0', prefix, generated.size) while generated.size <= max_index
      project.instance_variable_set(:@generated_uuids, generated)
      project.instance_variable_set(:@available_uuids, [])
    end

    def verify_pods_project_integrity!(installer)
      project = installer.pods_project
      return unless project && project.respond_to?(:root_object) && project.respond_to?(:objects_by_uuid)

      root = project.root_object
      resolved = root && project.objects_by_uuid[root.uuid]
      return if root && resolved.equal?(root) && resolved.isa == 'PBXProject'

      raise Pod::Informative,
            '[onramper-react-native] Pods.xcodeproj failed an integrity check and would not open in Xcode. ' \
            'Delete ios/Pods and run pod install again'
    end

    def apply_user_project(installer)
      installer.aggregate_targets.each do |aggregate|
        project = aggregate.user_project
        next if project.nil?

        links_us = aggregate.pod_targets.any? { |t| t.pod_name == POD_NAME }
        changed = false
        aggregate.user_targets.each do |target|
          next unless target.respond_to?(:symbol_type) && target.symbol_type == :application

          changed = true if links_us ? add_embed_phase(target) : remove_embed_phase(target)
        end
        project.save if changed
      end
    end

    private

    def add_embed_phase(target)
      phase = target.shell_script_build_phases.find { |p| p.name == PHASE_NAME }
      return false if phase && phase.shell_script == SCRIPT

      phase ||= target.new_shell_script_build_phase(PHASE_NAME)
      phase.shell_path = '/bin/sh'
      phase.shell_script = SCRIPT
      # No input/output lists (the framework's location varies by build type).
      phase.always_out_of_date = '1'
      true
    end

    def remove_embed_phase(target)
      phase = target.shell_script_build_phases.find { |p| p.name == PHASE_NAME }
      return false if phase.nil?

      phase.remove_from_project
      true
    end
  end
end

# Hook the installer once, however often the podspec is evaluated. The hooked
# methods are private in CocoaPods; alias_method keeps that, so check both
# visibilities and restore privacy afterwards.
if defined?(Pod::Installer)
  installer_class = Pod::Installer
  hooked = lambda do |name|
    installer_class.method_defined?(name) || installer_class.private_method_defined?(name)
  end

  unless hooked.call(:onramper_spm_original_post_install)
    was_private = installer_class.private_method_defined?(:run_podfile_post_install_hooks)
    installer_class.class_eval do
      alias_method :onramper_spm_original_post_install, :run_podfile_post_install_hooks

      define_method(:run_podfile_post_install_hooks) do
        ours = pod_targets.any? { |t| t.pod_name == OnramperSPM::POD_NAME }
        if ours
          begin
            OnramperSPM.ensure_uuid_counter_safe(self)
          rescue StandardError => e
            Pod::UI.warn "[onramper-react-native] Couldn't guard the Pods project's UUID counter (#{e.class}). " \
                         'If Xcode reports Pods.xcodeproj as damaged, delete ios/Pods and run pod install again.'
          end
        end
        result = onramper_spm_original_post_install
        OnramperSPM.verify_pods_project_integrity!(self) if ours
        result
      end
    end
    installer_class.send(:private, :run_podfile_post_install_hooks) if was_private
  end

  if hooked.call(:run_podfile_post_integrate_hooks) && !hooked.call(:onramper_spm_original_post_integrate)
    was_private = installer_class.private_method_defined?(:run_podfile_post_integrate_hooks)
    installer_class.class_eval do
      alias_method :onramper_spm_original_post_integrate, :run_podfile_post_integrate_hooks

      define_method(:run_podfile_post_integrate_hooks) do
        OnramperSPM.apply_user_project(self)
        onramper_spm_original_post_integrate
      end
    end
    installer_class.send(:private, :run_podfile_post_integrate_hooks) if was_private
  end
end
