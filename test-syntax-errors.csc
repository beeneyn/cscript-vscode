// Test CScript file with intentional syntax errors

// 1. Invalid pipeline operator
let badPipeline = data | filter; // Should be |>

// 2. Invalid match expression
let badMatch = value match {
    1 => "one"
    // Missing closing brace

// 3. Unclosed string
let unclosedString = "this string is not closed;

// 4. Invalid identifier
let 123invalid = "identifiers cannot start with numbers";

// 5. Mixed indentation (tabs and spaces)
function mixedIndent() {
	if (true) {
        console.log("mixed tabs and spaces");
	}
}

// 6. Invalid operator overloading
class Test {
    operator @@(other) { // @@ is not a valid operator
        return this;
    }
}

// 7. Invalid struct name
struct lowercase_struct { // Should be PascalCase
    value: number;
}

// 8. Invalid range in match
let rangeError = value match {
    10..5 => "invalid range", // start > end
    _ => "default"
};

// 9. Incomplete arrow function
let incomplete = () => ;

// 10. Malformed LINQ
let 2badVar = from user in users; // Invalid variable name

// 11. Unclosed parentheses
let unclosedParen = someFunction(arg1, arg2;

// 12. Good syntax examples (should not show errors)
let goodPipeline = data |> filter |> map;

let goodMatch = value match {
    1 => "one",
    2 => "two",
    _ => "other"
};

struct GoodStruct {
    value: number;
    
    operator +(other: GoodStruct): GoodStruct {
        return GoodStruct { value: this.value + other.value };
    }
}

let goodRange = value match {
    0..10 => "single digit",
    11.._ => "multi digit"
};