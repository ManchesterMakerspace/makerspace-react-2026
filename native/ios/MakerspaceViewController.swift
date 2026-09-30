import Capacitor
class MakerspaceViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(MakerspaceNfcPlugin()) }
}
