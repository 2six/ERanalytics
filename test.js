function evaluateExpression(expression, variables) {
    const keys = Object.keys(variables);
    const values = Object.values(variables);
  
    return new Function(...keys, `return ${expression}`)(...values);
  }

  const expression = "console.log('해킹!'); alert('😈');";
  const variables = { QLevel: 5, skillAmp: 50 };
  
  const result = evaluateExpression(expression, variables);
  console.log(result);