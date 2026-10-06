using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace TrailWise.Api.Contracts.Payments;

public class SubmitBankTransferRequest
{
    [FromForm(Name = "amount")]
    public decimal Amount { get; set; }

    [FromForm(Name = "bankSlip")]
    public IFormFile? BankSlip { get; set; }
}
