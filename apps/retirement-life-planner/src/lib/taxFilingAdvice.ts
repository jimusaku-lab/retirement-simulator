import type { AutoTaxYearDetail } from "@/lib/taxEngine";

export type TaxFilingAdviceStatus = "notRequiredLikely" | "review" | "attention";

export type TaxFilingAdvice = {
  id: string;
  fiscalYear: number;
  memberId: string;
  memberName: string;
  status: TaxFilingAdviceStatus;
  pensionGrossAnnual: number;
  nonPensionIncomeAnnual: number;
  incomeTaxAnnual: number;
  residentTaxAnnual: number;
  message: string;
};

const PUBLIC_PENSION_FILING_EXEMPTION_GROSS_LIMIT = 4_000_000;
const OTHER_INCOME_FILING_EXEMPTION_LIMIT = 200_000;

export function getTaxFilingAdvice(details: AutoTaxYearDetail[]): TaxFilingAdvice[] {
  return details.flatMap((detail) =>
    detail.memberDetails.map((member) => {
      const pensionIncome = Math.max(0, member.pensionGrossAnnual - member.pensionDeductionAnnual);
      const nonPensionIncomeAnnual = Math.max(
        0,
        member.taxableIncomeBeforeBasicDeductionAnnual - pensionIncome + member.retirementIncomeAnnual,
      );
      const incomeTaxAnnual = member.incomeTaxAnnual + member.retirementIncomeTaxAnnual;
      const residentTaxAnnual = member.residentTaxAnnual + member.retirementResidentTaxAnnual;
      const hasPension = member.pensionGrossAnnual > 0;
      const mayUsePensionExemption =
        hasPension &&
        member.pensionGrossAnnual <= PUBLIC_PENSION_FILING_EXEMPTION_GROSS_LIMIT &&
        nonPensionIncomeAnnual <= OTHER_INCOME_FILING_EXEMPTION_LIMIT;

      if (mayUsePensionExemption) {
        return {
          id: `${detail.fiscalYear}-${member.memberId}-filing`,
          fiscalYear: detail.fiscalYear,
          memberId: member.memberId,
          memberName: member.memberName,
          status: "notRequiredLikely" as const,
          pensionGrossAnnual: member.pensionGrossAnnual,
          nonPensionIncomeAnnual,
          incomeTaxAnnual,
          residentTaxAnnual,
          message:
            "公的年金等収入400万円以下かつ年金以外の所得20万円以下のため、所得税は申告不要制度の対象になり得ます。住民税申告や還付申告は別途確認してください。",
        };
      }

      if (hasPension) {
        const reasons = [
          member.pensionGrossAnnual > PUBLIC_PENSION_FILING_EXEMPTION_GROSS_LIMIT ? "公的年金等収入が400万円を超えています" : "",
          nonPensionIncomeAnnual > OTHER_INCOME_FILING_EXEMPTION_LIMIT ? "年金以外の所得が20万円を超えています" : "",
        ].filter(Boolean);
        return {
          id: `${detail.fiscalYear}-${member.memberId}-filing`,
          fiscalYear: detail.fiscalYear,
          memberId: member.memberId,
          memberName: member.memberName,
          status: "review" as const,
          pensionGrossAnnual: member.pensionGrossAnnual,
          nonPensionIncomeAnnual,
          incomeTaxAnnual,
          residentTaxAnnual,
          message: `${reasons.join("。")}。所得税の確定申告要否を確認してください。`,
        };
      }

      return {
        id: `${detail.fiscalYear}-${member.memberId}-filing`,
        fiscalYear: detail.fiscalYear,
        memberId: member.memberId,
        memberName: member.memberName,
        status: incomeTaxAnnual > 0 || residentTaxAnnual > 0 ? "attention" : "notRequiredLikely",
        pensionGrossAnnual: member.pensionGrossAnnual,
        nonPensionIncomeAnnual,
        incomeTaxAnnual,
        residentTaxAnnual,
        message:
          incomeTaxAnnual > 0 || residentTaxAnnual > 0
            ? "年金以外の課税所得があります。申告や源泉徴収・住民税通知との照合対象です。"
            : "課税所得がほぼないため、申告要否の優先度は低い見込みです。",
      };
    }),
  );
}
