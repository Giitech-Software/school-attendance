const fs = require("node:fs/promises");
const path = require("node:path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("@expo/config-plugins");

function withFaceLiveness(config) {
  const appPackage = config.android?.package;
  if (!appPackage) throw new Error("android.package is required for the Face Liveness native bridge.");

  config = withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes("com.amplifyframework.ui:liveness")) {
      contents = contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n    implementation 'com.amplifyframework.ui:liveness:1.5.0'\n    implementation 'androidx.compose.material3:material3:1.1.2'`
      );
    }
    if (!/compose\s+true/.test(contents)) {
      contents = contents.replace(/android\s*\{/, (match) => `${match}\n    buildFeatures { compose true }\n    composeOptions { kotlinCompilerExtensionVersion '1.5.3' }`);
    }
    mod.modResults.contents = contents;
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    const importLine = `import ${appPackage}.FaceLivenessPackage`;
    if (!contents.includes(importLine)) {
      const classStart = contents.search(/\n(?:class|public class)\s+MainApplication/);
      if (classStart < 0) throw new Error("Could not locate MainApplication class for the Face Liveness package registration.");
      contents = `${contents.slice(0, classStart)}\n${importLine}${contents.slice(classStart)}`;
    }
    if (!contents.includes("FaceLivenessPackage()")) {
      if (/PackageList\(this\)\.packages\.apply\s*\{/.test(contents)) {
        contents = contents.replace(/(PackageList\(this\)\.packages\.apply\s*\{)/, "$1\n              add(FaceLivenessPackage())");
      } else if (/List<ReactPackage>\s+packages\s*=\s*new PackageList\(this\)\.getPackages\(\);/.test(contents)) {
        contents = contents.replace(/(List<ReactPackage>\s+packages\s*=\s*new PackageList\(this\)\.getPackages\(\);)/, "$1\n        packages.add(new FaceLivenessPackage());");
      } else {
        throw new Error("Could not locate the React Native package list in MainApplication.");
      }
    }
    mod.modResults.contents = contents;
    return mod;
  });

  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error("Android manifest has no application element.");
    application.activity ??= [];
    const existing = application.activity.find((entry) => entry.$?.["android:name"] === ".FaceLivenessActivity");
    if (!existing) {
      application.activity.push({
        $: {
          "android:name": ".FaceLivenessActivity",
          "android:exported": "false",
          "android:screenOrientation": "portrait",
        },
      });
    }
    return mod;
  });

  return withDangerousMod(config, ["android", async (mod) => {
    const packagePath = appPackage.replaceAll(".", path.sep);
    const sourceDir = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "java", packagePath);
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "FaceLivenessPackage.kt"), packageSource(appPackage));
    await fs.writeFile(path.join(sourceDir, "FaceLivenessModule.kt"), moduleSource(appPackage));
    await fs.writeFile(path.join(sourceDir, "FaceLivenessActivity.kt"), activitySource(appPackage));
    return mod;
  }]);
}

function packageSource(appPackage) {
  return `package ${appPackage}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FaceLivenessPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(FaceLivenessModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;
}

function moduleSource(appPackage) {
  return `package ${appPackage}

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FaceLivenessModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), ActivityEventListener {
  private var pendingPromise: Promise? = null
  init { context.addActivityEventListener(this) }
  override fun getName() = "FaceLiveness"

  @ReactMethod
  fun start(sessionId: String, region: String, credentials: com.facebook.react.bridge.ReadableMap, promise: Promise) {
    val activity = currentActivity
    if (activity == null) { promise.reject("NO_ACTIVITY", "The app is not in the foreground."); return }
    if (pendingPromise != null) { promise.reject("IN_PROGRESS", "A liveness check is already in progress."); return }
    pendingPromise = promise
    activity.startActivityForResult(Intent(activity, FaceLivenessActivity::class.java).apply {
      putExtra(FaceLivenessActivity.EXTRA_SESSION_ID, sessionId)
      putExtra(FaceLivenessActivity.EXTRA_REGION, region)
      putExtra(FaceLivenessActivity.EXTRA_ACCESS_KEY_ID, credentials.getString("accessKeyId"))
      putExtra(FaceLivenessActivity.EXTRA_SECRET_ACCESS_KEY, credentials.getString("secretAccessKey"))
      putExtra(FaceLivenessActivity.EXTRA_SESSION_TOKEN, credentials.getString("sessionToken"))
    }, REQUEST_CODE)
  }

  override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    val promise = pendingPromise ?: return
    pendingPromise = null
    if (resultCode == Activity.RESULT_OK) promise.resolve(true)
    else promise.reject("LIVENESS_FAILED", "Face liveness was cancelled or failed.")
  }
  override fun onNewIntent(intent: Intent?) = Unit
  companion object { private const val REQUEST_CODE = 8127 }
}
`;
}

function activitySource(appPackage) {
  return `package ${appPackage}

import android.app.Activity
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import com.amplifyframework.ui.liveness.FaceLivenessDetector
import com.amplifyframework.ui.liveness.LivenessColorScheme
import com.amazonaws.auth.AWSStaticCredentialsProvider
import com.amazonaws.auth.BasicSessionCredentials

class FaceLivenessActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
    val region = intent.getStringExtra(EXTRA_REGION)
    val accessKeyId = intent.getStringExtra(EXTRA_ACCESS_KEY_ID)
    val secretAccessKey = intent.getStringExtra(EXTRA_SECRET_ACCESS_KEY)
    val sessionToken = intent.getStringExtra(EXTRA_SESSION_TOKEN)
    if (sessionId.isNullOrBlank() || region.isNullOrBlank() || accessKeyId.isNullOrBlank() || secretAccessKey.isNullOrBlank() || sessionToken.isNullOrBlank()) {
      setResult(Activity.RESULT_CANCELED); finish(); return
    }
    setContent {
      MaterialTheme(colorScheme = LivenessColorScheme.default()) {
        FaceLivenessDetector(
          sessionId = sessionId,
          region = region,
          credentialsProvider = AWSStaticCredentialsProvider(BasicSessionCredentials(accessKeyId, secretAccessKey, sessionToken)),
          onComplete = { setResult(Activity.RESULT_OK); finish() },
          onError = { error -> Log.e("FaceLiveness", "Face liveness failed", error); setResult(Activity.RESULT_CANCELED); finish() },
        )
      }
    }
  }
  companion object {
    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_REGION = "region"
    const val EXTRA_ACCESS_KEY_ID = "accessKeyId"
    const val EXTRA_SECRET_ACCESS_KEY = "secretAccessKey"
    const val EXTRA_SESSION_TOKEN = "sessionToken"
  }
}
`;
}

module.exports = withFaceLiveness;
