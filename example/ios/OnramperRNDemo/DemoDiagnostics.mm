#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>

// Demo-only file sink. The library exposes records; each integrating app owns
// storage/export. Accept only SDK records here, never session credentials or
// arbitrary request/response payloads. All file operations use one serial queue.
@interface DemoDiagnostics : NSObject <RCTBridgeModule>
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

- (NSURL *)directory {
  NSURL *base = [[NSFileManager defaultManager] URLsForDirectory:NSCachesDirectory inDomains:NSUserDomainMask].firstObject;
  NSURL *dir = [base URLByAppendingPathComponent:@"OnramperDiagnostics" isDirectory:YES];
  [[NSFileManager defaultManager] createDirectoryAtURL:dir withIntermediateDirectories:YES attributes:@{NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication} error:nil];
  return dir;
}

- (NSArray<NSURL *> *)logFiles {
  NSURL *dir = [self directory];
  return @[[dir URLByAppendingPathComponent:@"previous.log"], [dir URLByAppendingPathComponent:@"current.log"]];
}

- (void)prune {
  for (NSURL *url in [self logFiles]) {
    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:url.path error:nil];
    NSDate *created = attributes[NSFileCreationDate];
    if (created && -created.timeIntervalSinceNow > 7 * 24 * 60 * 60) {
      [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
    }
  }
}

RCT_EXPORT_METHOD(getEnabled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@([[NSUserDefaults standardUserDefaults] boolForKey:@"onramperDiagnosticLogging"]));
}

RCT_EXPORT_METHOD(setEnabled:(BOOL)enabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [[NSUserDefaults standardUserDefaults] setBool:enabled forKey:@"onramperDiagnosticLogging"];
  resolve(nil);
}

RCT_EXPORT_METHOD(appendRecord:(NSString *)json) {
  if (![[NSUserDefaults standardUserDefaults] boolForKey:@"onramperDiagnosticLogging"]) return;
  // The SDK bounds/sanitizes records. Bound again at the file boundary.
  NSData *raw = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (!raw || raw.length > 64 * 1024) return;
  NSDictionary *record = [NSJSONSerialization JSONObjectWithData:raw options:0 error:nil];
  if (![record isKindOfClass:NSDictionary.class] || ![record[@"event"] isKindOfClass:NSString.class] || ![record[@"context"] isKindOfClass:NSDictionary.class]) return;
  [self prune];
  NSArray<NSURL *> *files = [self logFiles];
  NSURL *current = files.lastObject;
  NSFileManager *fm = [NSFileManager defaultManager];
  unsigned long long size = [[fm attributesOfItemAtPath:current.path error:nil][NSFileSize] unsignedLongLongValue];
  // Two files, each capped at 2.5 MiB (5 MiB total).
  if (size + raw.length + 1 > 2621440) {
    [fm removeItemAtURL:files.firstObject error:nil];
    if (![fm moveItemAtURL:current toURL:files.firstObject error:nil]) return;
  }
  if (![fm fileExistsAtPath:current.path]) [fm createFileAtPath:current.path contents:nil attributes:@{NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication}];
  NSFileHandle *handle = [NSFileHandle fileHandleForWritingToURL:current error:nil];
  if (!handle) return;
  @try {
    [handle seekToEndOfFile];
    [handle writeData:raw];
    [handle writeData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]];
  } @catch (NSException *exception) {
    // Diagnostics must not interrupt checkout, including when storage is full.
  } @finally {
    [handle closeFile];
  }
}

RCT_EXPORT_METHOD(clearLogs:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  for (NSURL *url in [self logFiles]) {
    NSError *error = nil;
    if ([[NSFileManager defaultManager] fileExistsAtPath:url.path] && ![[NSFileManager defaultManager] removeItemAtURL:url error:&error]) {
      reject(@"delete_failed", @"Could not delete diagnostic logs.", nil);
      return;
    }
  }
  resolve(nil);
}

RCT_EXPORT_METHOD(shareLogs:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [self prune];
  NSMutableData *data = [NSMutableData data];
  for (NSURL *url in [self logFiles]) {
    NSData *part = [NSData dataWithContentsOfURL:url];
    if (part) [data appendData:part];
  }
  if (data.length == 0) {
    reject(@"no_logs", @"Enable diagnostic logging and reproduce the issue first.", nil);
    return;
  }
  NSString *name = [NSString stringWithFormat:@"onramper-rn-%@.log", NSUUID.UUID.UUIDString];
  NSURL *snapshot = [[NSURL fileURLWithPath:NSTemporaryDirectory()] URLByAppendingPathComponent:name];
  if (![data writeToURL:snapshot options:NSDataWritingAtomic | NSDataWritingFileProtectionCompleteUntilFirstUserAuthentication error:nil]) {
    reject(@"export_failed", @"Could not prepare diagnostic logs.", nil);
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter) {
      [[NSFileManager defaultManager] removeItemAtURL:snapshot error:nil];
      reject(@"export_failed", @"Could not open the share sheet.", nil);
      return;
    }
    UIActivityViewController *share = [[UIActivityViewController alloc] initWithActivityItems:@[snapshot] applicationActivities:nil];
    share.popoverPresentationController.sourceView = presenter.view;
    share.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 1, 1);
    share.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *items, NSError *error) {
      [[NSFileManager defaultManager] removeItemAtURL:snapshot error:nil];
      resolve(nil);
    };
    [presenter presentViewController:share animated:YES completion:nil];
  });
}
@end
