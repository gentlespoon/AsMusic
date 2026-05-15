import UIKit
import Capacitor

final class BridgeViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // `registerPluginType` is a no-op while `autoRegisterPlugins` is true (the default).
        // `packageClassList` in capacitor.config.json is filled only from npm Capacitor plugins,
        // so this app-local plugin is never auto-discovered. Register an explicit instance so
        // JS gets PluginHeaders + native bridge (Keychain, AVPlayer) before the first page load.
        bridge?.registerPluginInstance(AsmusicNativePlugin())
    }
}
