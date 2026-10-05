using System.Text.Json;
using TrailWise.Api.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class JsonRedactorTests
{
    [Theory]
    [InlineData("password")]
    [InlineData("Password")]
    [InlineData("userPassword")]
    [InlineData("secret")]
    [InlineData("clientSecret")]
    [InlineData("accessToken")]
    [InlineData("token")]
    [InlineData("apiKey")]
    [InlineData("api_key")]
    [InlineData("api-key")]
    [InlineData("Authorization")]
    [InlineData("cardNumber")]
    [InlineData("card_number")]
    [InlineData("cvv")]
    [InlineData("CVC")]
    [InlineData("credentials")]
    public void SensitiveKeys_AreRedacted_WhateverTheCasingOrPrefix(string key)
    {
        var json = JsonSerializer.Serialize(new Dictionary<string, object> { [key] = "value-that-must-not-leak", ["safe"] = "visible" });

        var redacted = JsonRedactor.ParseAndRedact(json)!.Value;

        Assert.Equal(JsonRedactor.Placeholder, redacted.GetProperty(key).GetString());
        Assert.Equal("visible", redacted.GetProperty("safe").GetString());
    }

    [Fact]
    public void Redaction_ReachesNestedObjectsAndArrays_AndLeavesOrdinaryDataAlone()
    {
        var redacted = JsonRedactor.ParseAndRedact(
            """{"a":{"b":[{"token":"x","guideId":"g1"},{"deep":{"password":"p","score":0.9}}]},"count":3,"flag":true,"none":null}""")!.Value;

        var list = redacted.GetProperty("a").GetProperty("b");
        Assert.Equal(JsonRedactor.Placeholder, list[0].GetProperty("token").GetString());
        Assert.Equal("g1", list[0].GetProperty("guideId").GetString());
        Assert.Equal(JsonRedactor.Placeholder, list[1].GetProperty("deep").GetProperty("password").GetString());
        Assert.Equal(0.9, list[1].GetProperty("deep").GetProperty("score").GetDouble());
        Assert.Equal(3, redacted.GetProperty("count").GetInt32());
        Assert.True(redacted.GetProperty("flag").GetBoolean());
        Assert.Equal(JsonValueKind.Null, redacted.GetProperty("none").ValueKind);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json")]
    [InlineData("{\"unterminated\":")]
    public void EmptyOrMalformedJson_ReturnsNull(string? json) => Assert.Null(JsonRedactor.ParseAndRedact(json));

    [Fact]
    public void TopLevelArraysAndScalars_AreHandled()
    {
        Assert.Equal(2, JsonRedactor.ParseAndRedact("""[{"token":"a"},{"ok":1}]""")!.Value.GetArrayLength());
        Assert.Equal(5, JsonRedactor.ParseAndRedact("5")!.Value.GetInt32());
    }
}
