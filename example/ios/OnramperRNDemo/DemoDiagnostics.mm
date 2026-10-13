#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <UIKit/UIKit.h>
#import <sys/utsname.h>
#import "OnramperRNDemo-Swift.h"

// Demo-only adapter. The library exposes SDK records; the app owns retention,
// browsing and export. Never send credentials or arbitrary API bodies here.
@interface DemoDiagnostics : NSObject <RCTBridgeModule>
@property(nonatomic, strong) DemoDailyLogStore *store;
@end

@implementation DemoDiagnostics
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }
- (dispatch_queue_t)methodQueue {
  static dispatch_queue_t queue;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ queue = dispatch_queue_create("com.onramper.rn.diagnostics", DISPATCH_QUEUE_SERIAL); });
  return queue;
}

- (instancetype)init {
  if ((self = [super init])) {
    NSDictionary *info = NSBundle.mainBundle.infoDictionary;
    struct utsname model;
    NSString *device = uname(&model) == 0 ? [NSString stringWithUTF8String:model.machine] : @"unknown";
    NSOperatingSystemVersion version = NSProcessInfo.processInfo.operatingSystemVersion;
    NSString *ios = [NSString stringWithFormat:@"%ld.%ld.%ld", (long)version.majorVersion, (long)version.minorVersion, (long)version.patchVersion];
    _store = [[DemoDailyLogStore alloc] initWithMetadata:@{
      @"appVersion": info[@"CFBundleShortVersionString"] ?: @"unknown",
      @"build": info[@"CFBundleVersion"] ?: @"unknown",
      @"ios": ios,
      @"device": device ?: @"unknown"
    }];
  }
  return self;
}

RCT_EXPORT_METHOD(getEnabled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@([[NSUserDefaults standardUserDefaults] boolForKey:@"onramperDiagnosticLogging"]));
}

RCT_EXPORT_METHOD(setEnabled:(BOOL)enabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [[NSUserDefaults standardUserDefaults] setBool:enabled forKey:@"onramperDiagnosticLogging"];
  resolve(nil);
}

RCT_EXPORT_METHOD(appendRecord:(NSString *)json) {
  if ([[NSUserDefaults standardUserDefaults] boolForKey:@"onramperDiagnosticLogging"]) {
    [self.store appendRecord:json];
  }
}

RCT_EXPORT_METHOD(listFiles:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve([self.store files]);
}

RCT_EXPORT_METHOD(readFile:(NSString *)name resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSString *text = [self.store readFile:name error:&error];
  if (error) { reject(@"read_failed", @"Could not read this log file. Refresh the list and try again.", nil); }
  else { resolve(text); }
}

RCT_EXPORT_METHOD(clearLogs:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  if (![self.store clearLogsAndReturnError:&error]) { reject(@"delete_failed", @"Could not delete diagnostic logs.", nil); }
  else { resolve(nil); }
}

RCT_EXPORT_METHOD(shareFile:(NSString *)name resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSURL *snapshot = [self.store snapshotForFile:name error:&error];
  if (!snapshot) {
    reject(@"export_failed", @"Could not prepare this log file. Refresh the list and try again.", nil);
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter) {
      [[NSFileManager defaultManager] removeItemAtURL:snapshot.URLByDeletingLastPathComponent error:nil];
      reject(@"export_failed", @"Could not open the share sheet.", nil);
      return;
    }
    UIActivityViewController *share = [[UIActivityViewController alloc] initWithActivityItems:@[snapshot] applicationActivities:nil];
    share.popoverPresentationController.sourceView = presenter.view;
    share.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 1, 1);
    share.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *items, NSError *error) {
      [[NSFileManager defaultManager] removeItemAtURL:snapshot.URLByDeletingLastPathComponent error:nil];
      if (error) { reject(@"share_failed", @"Could not share this log file.", nil); }
      else { resolve(nil); }
    };
    [presenter presentViewController:share animated:YES completion:nil];
  });
}
@end
