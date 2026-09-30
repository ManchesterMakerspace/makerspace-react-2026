import Capacitor
import CoreNFC

@objc(MakerspaceNfcPlugin)
public class MakerspaceNfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCTagReaderSessionDelegate {
    public let identifier = "MakerspaceNfcPlugin"
    public let jsName = "MakerspaceNfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var session: NFCTagReaderSession?
    private var mode = "ndef"
    private var activeSession = ""
    private var backgroundObserver: NSObjectProtocol?
    override public func load() {
        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.stopSession() }
    }
    deinit { if let observer = backgroundObserver { NotificationCenter.default.removeObserver(observer) } }

    @objc func capabilities(_ call: CAPPluginCall) {
        call.resolve(["supported": NFCTagReaderSession.readingAvailable, "enabled": NFCTagReaderSession.readingAvailable])
    }
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard NFCTagReaderSession.readingAvailable else { call.reject("NFC is unavailable on this device."); return }
            self.stopSession()
            self.activeSession = call.getString("sessionId") ?? ""
            self.mode = call.getString("mode") ?? "ndef"
            guard ["ndef", "inspect", "enroll"].contains(self.mode) else { call.reject("Invalid scan mode"); return }
            // ISO14443 covers supported MIFARE tags; Classic is not supported by Core NFC.
            self.session = NFCTagReaderSession(pollingOption: [.iso14443, .iso15693], delegate: self, queue: .main)
            self.session?.alertMessage = "Hold your iPhone near the card."
            self.session?.begin()
            call.resolve()
        }
    }
    @objc func stop(_ call: CAPPluginCall) { DispatchQueue.main.async {
        if self.activeSession == call.getString("sessionId") { self.stopSession() }; call.resolve()
    } }
    private func stopSession() { let previous = session; session = nil; previous?.invalidate() }
    public func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}
    public func tagReaderSession(_ reader: NFCTagReaderSession, didInvalidateWithError error: Error) {
        guard session === reader else { return }
        session = nil
        notifyListeners("scanError", data: ["message": error.localizedDescription])
    }
    public func tagReaderSession(_ reader: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        guard session === reader else { return }
        guard tags.count == 1, let tag = tags.first else { reader.alertMessage = "Present one card at a time."; reader.restartPolling(); return }
        reader.connect(to: tag) { error in
            guard self.session === reader else { return }
            if let error = error { reader.invalidate(errorMessage: error.localizedDescription); return }
            let uid: Data
            let ndef: NFCNDEFTag
            switch tag {
            case .miFare(let value): uid = value.identifier; ndef = value
            case .iso7816(let value): uid = value.identifier; ndef = value
            case .iso15693(let value): uid = value.identifier; ndef = value
            case .feliCa(let value): uid = value.currentIDm; ndef = value
            @unknown default: reader.invalidate(errorMessage: "Unsupported NFC card."); return
            }
            var result: [String: Any] = ["urls": [String](), "texts": [String](), "unsupported": [String]()]
            if self.mode != "ndef" { result["uid"] = uid.map { String(format: "%02X", $0) }.joined() }
            let finish = { (data: [String: Any]) in
                DispatchQueue.main.async {
                    guard self.session === reader else { return }
                    self.stopSession(); self.notifyListeners("tag", data: data)
                }
            }
            if self.mode == "enroll" { finish(result); return }
            ndef.queryNDEFStatus { status, _, error in
                guard self.session === reader else { return }
                guard error == nil, status != .notSupported else { finish(result); return }
                ndef.readNDEF { message, error in
                    guard self.session === reader else { return }
                    if let message = message {
                        do {
                            let decoded = try self.decode(message, depth: 0)
                            result.merge(decoded) { _, new in new }
                        } catch { result["warning"] = "NDEF message is malformed or too large." }
                    } else if error != nil { result["warning"] = "NDEF could not be read. Try again." }
                    finish(result)
                }
            }
        }
    }
    private func decode(_ message: NFCNDEFMessage, depth: Int) throws -> [String: Any] {
        guard depth <= 4, message.records.count <= 64, message.length <= 32768 else { throw NSError(domain: "NDEF", code: 1) }
        var urls = [String](), texts = [String](), unsupported = [String]()
        let hasPoster = message.records.contains { $0.typeNameFormat == .nfcWellKnown && $0.type == Data("Sp".utf8) }
        for record in message.records {
            if record.typeNameFormat == .nfcWellKnown && record.type == Data("Sp".utf8) {
                guard let nested = NFCNDEFMessage(data: record.payload) else { throw NSError(domain: "NDEF", code: 2) }
                let content = try decode(nested, depth: depth + 1)
                urls += content["urls"] as? [String] ?? []; texts += content["texts"] as? [String] ?? []
                unsupported += content["unsupported"] as? [String] ?? []
            } else if let url = record.wellKnownTypeURIPayload() {
                if !hasPoster { urls.append(url.absoluteString) }
            } else if record.typeNameFormat == .absoluteURI, let uri = String(data: record.type, encoding: .utf8) {
                if !hasPoster { urls.append(uri) }
            } else if let text = record.wellKnownTypeTextPayload().0 { texts.append(text) }
            else if record.typeNameFormat != .empty { unsupported.append("TNF \(record.typeNameFormat.rawValue)") }
        }
        return ["urls": urls, "texts": texts, "unsupported": unsupported]
    }
}
