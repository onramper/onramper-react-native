import XCTest
@testable internal import OnramperReactNative
import OnramperSDK

// Pins the flat JS shape the bridge emits for checkout requirements. The TS
// `CheckoutRequirement` union is flat (`{ type, ...fields }`); Swift's Codable
// would nest under `{ type, requirement: {...} }`, so `requirementToJSDict`
// flattens explicitly. These assertions guard against a silent regression back
// to the nested shape.
final class RequirementFlatteningTests: XCTestCase {

    func test_tos_flattensWithItems() {
        let req = CheckoutRequirement.tos(ToSRequirement(
            providerId: "coinbasepay",
            items: [ToSItem(type: .tos, required: true, satisfied: false, url: "https://x", content: nil)]
        ))
        let dict = requirementToJSDict(req)

        XCTAssertEqual(dict["type"] as? String, "tos")
        XCTAssertEqual(dict["providerId"] as? String, "coinbasepay")
        XCTAssertNil(dict["requirement"], "must be flat, not nested under `requirement`")
        let items = dict["items"] as? [[String: Any]]
        XCTAssertEqual(items?.first?["type"] as? String, "tos")
        XCTAssertEqual(items?.first?["satisfied"] as? Bool, false)
    }

    func test_amountLimit_flattensWithSatisfiedFlag() {
        let req = CheckoutRequirement.amountLimit(AmountLimitRequirement(
            providerId: "moonpay", minAmountLimit: 20, maxAmountLimit: nil, amountLimitSatisfied: false
        ))
        let dict = requirementToJSDict(req)

        XCTAssertEqual(dict["type"] as? String, "amount_limit")
        XCTAssertEqual(dict["providerId"] as? String, "moonpay")
        XCTAssertEqual(dict["amountLimitSatisfied"] as? Bool, false)
        XCTAssertEqual(dict["minAmountLimit"] as? Double, 20)
        XCTAssertNil(dict["maxAmountLimit"], "absent optional must be omitted, not null")
        XCTAssertNil(dict["requirement"])
    }

    func test_userInfo_flattensWithFields() {
        let req = CheckoutRequirement.userInfo(UserInfoRequirement(
            providerId: "moonpay",
            fields: [UserInfoField(type: .phoneNumber, required: true, satisfied: false)]
        ))
        let dict = requirementToJSDict(req)

        XCTAssertEqual(dict["type"] as? String, "user_info")
        let fields = dict["fields"] as? [[String: Any]]
        XCTAssertEqual(fields?.first?["type"] as? String, "phone_number")
        XCTAssertEqual(fields?.first?["satisfied"] as? Bool, false)
        XCTAssertNil(dict["requirement"])
    }

    func test_reverification_flattensPhoneFields() {
        let req = CheckoutRequirement.reverification(ReverificationRequirement(
            providerId: "moonpay", field: .phone, requiredRecencyDays: 30, lastVerifiedAt: "2026-01-01T00:00:00Z"
        ))
        let dict = requirementToJSDict(req)

        XCTAssertEqual(dict["type"] as? String, "reverification")
        XCTAssertEqual(dict["providerId"] as? String, "moonpay")
        XCTAssertEqual(dict["field"] as? String, "phone")
        XCTAssertEqual(dict["requiredRecencyDays"] as? Int, 30)
        XCTAssertEqual(dict["lastVerifiedAt"] as? String, "2026-01-01T00:00:00Z")
        XCTAssertNil(dict["requirement"])
    }

    func test_reverification_omitsAbsentLastVerifiedAt() {
        let req = CheckoutRequirement.reverification(ReverificationRequirement(
            providerId: "moonpay", field: .phone, requiredRecencyDays: 30, lastVerifiedAt: nil
        ))
        let dict = requirementToJSDict(req)
        XCTAssertNil(dict["lastVerifiedAt"], "absent optional must be omitted, not null")
    }
}
