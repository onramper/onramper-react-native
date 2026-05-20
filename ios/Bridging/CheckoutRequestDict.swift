import ExpoModulesCore
import OnramperSDK

struct WalletInfoDict: Record {
    @Field var network: String = ""
    @Field var address: String = ""
    @Field var memo: String? = nil

    func toSwift() -> WalletInfo {
        WalletInfo(network: network, address: address, memo: memo)
    }
}

struct CheckoutRequestDict: Record {
    @Field var onramp: String = ""
    @Field var source: String = ""
    @Field var destination: String? = nil
    @Field var amount: Double = 0
    @Field var type: String = "buy"
    @Field var country: String? = nil
    @Field var subdivision: String? = nil
    @Field var paymentMethod: String = ""
    @Field var wallet: WalletInfoDict = WalletInfoDict()
    @Field var onlyOnramps: [String]? = nil

    func toSwift() -> CheckoutIntentRequest {
        let txData = OnramperTransactionData(
            onramp: onramp,
            source: source,
            destination: destination,
            amount: amount,
            type: type == "sell" ? .sell : .buy,
            country: country,
            subdivision: subdivision,
            paymentMethod: paymentMethod,
            wallet: wallet.toSwift()
        )
        return CheckoutIntentRequest(onramperTransactionData: txData, onlyOnramps: onlyOnramps)
    }
}
