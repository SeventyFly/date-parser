const { Expression, LoadMonthSize, LoadSeparators } = require('./loader');

/**
 * @param {String} str 
 * @param {Number} index 
 * @param {String} char 
 */
function replaceAt(str, index, char) {
   return str.substring(0, index) + char + str.substring(index + 1);
}

const DateTypes = Object.freeze({
   target: "target_date",
   period: "period_time",
   max: "max_date"
});

/**
 * 
 * @param {*} property 
 * @returns {Boolean} 
 */
function isDateType(property) {
   for (const dateType in DateTypes) {
      if (DateTypes.hasOwnProperty(dateType)) {
         if (DateTypes[dateType] == property) {
            return true;
         }
      }
   }
   return false;
}

const TimeTypes = Object.freeze({
   seconds: "seconds",
   minutes: "minutes",
   hours: "hours",
   dates: "dates",
   months: "months",
   nMonth: "nMonth",
   years: "years"
});

/**
 * 
 * @param {*} property 
 * @returns {Boolean} 
 */
function isTimeType(property) {
   for (const timeType in TimeTypes) {
      if (TimeTypes.hasOwnProperty(timeType)) {
         if (TimeTypes[timeType] == property) {
            return true;
         }
      }
   }
   return false;
}

/**
 * @param {Date} date 
 * @param {TimeTypes} timeType 
 * @param {Number} value 
 * @returns {Date} 
 */
function setDateProperty(date, timeType, value) {
   switch (timeType) {
      case TimeTypes.dates:
         date.setUTCDateDate(value);
         break;
      case TimeTypes.hours:
         date.setUTCHours(value);
         break;
      case TimeTypes.minutes:
         date.setUTCMinutes(value);
         break;
      case TimeTypes.months:
         date.setUTCMonth(value);
         break;
      case TimeTypes.seconds:
         date.setUTCSeconds(value);
         break;
      case TimeTypes.years:
         date.setUTCFullYear(value);
         break;
      default:
         break;
   }
   return date;
}

/**
 * @param {Date} date  
 * @param {TimeTypes} timeType 
 * @param {Boolean} 
 * @returns {Number}
 */
function getDateProperty(date, timeType, increaseMonth) {
   switch (timeType) {
      case TimeTypes.seconds:
         return date.getUTCSeconds();
      case TimeTypes.minutes:
         return date.getUTCMinutes();
      case TimeTypes.hours:
         return date.getUTCHours();
      case TimeTypes.dates:
         return date.getUTCDate();
      case TimeTypes.months:
         return date.getUTCMonth() + +increaseMonth;
      case TimeTypes.years:
         return date.getUTCFullYear();
      default:
         return -1;
   }
}

const ValidModes = Object.freeze({
   certified: 1,
   notCertified: 0,
   notValid: -1,
   none: -100
});

class ParsedTime {
   /**@type {DateTypes} */
   dateType;
   /**@type {TimeTypes} */
   timeType;
   /**@type {Number} */
   number;
   /**@type {Array.<Number>} */
   indexes;
   /**@type {Number} */
   context;
   /**@type {Number} */
   prevalence;
   /**@type {ValidModes} */
   validMode;
   /**@type {Boolean} */
   isOffset;
   /**@type {Boolean} */
   isFixed;
   /**
    * @param {DateTypes} dateType 
    * @param {TimeTypes} timeType 
    * @param {Number} number 
    * @param {Array.<Number>} indexes 
    * @param {Number} context 
    * @param {Number} prevalence 
    * @param {{}} options 
    */
   constructor(dateType, timeType, number, indexes, context, prevalence, options) {
      this.dateType = dateType;
      this.timeType = timeType;
      this.number = number;
      this.indexes = indexes;
      this.context = context;
      this.prevalence = prevalence;
      if (typeof (options) != 'undefined') {
         this.validMode = typeof (options.validMode) == 'undefined' ? ValidModes.notCertified : options.validMode;
         this.isOffset = typeof (options.isOffset) == 'undefined' ? false : options.isOffset;
         this.isFixed = typeof (options.isFixed) == 'undefined' ? false : options.isFixed;
      } else {
         this.validMode = ValidModes.notCertified;
         this.isOffset = this.isFixed = false;
      }
   }
}

class ParseCase {
   /**@type {Number} */
   prevalence;
   /**@type {Function} */
   parseFunction;
   /**
    * @param {Number} prevalence 
    * @param {Function} parseFunction 
    */
   constructor(prevalence, parseFunction) {
      this.prevalence = prevalence;
      this.parseFunction = parseFunction;
   }
}

class Context {
   /**@type {Number} */
   start;
   /**@type {Number} */
   end;
   /**
    * @param {Number} start 
    * @param {Number} end 
    */
   constructor(start, end) {
      this.start = start;
      this.end = end;
   }
}

class ContextsData {
   /**@type Array.<Context> */
   contexts = [];
   /**@type Array.<Number> */
   usedContexts = [];

   constructor() {
   }
}

/**
 * @this {Array.<Expression>} 
 * @returns {{separatingWords: Array.<Number>, contexts: Array.<Context>}}
 */
function splitContext() {
   const separators = LoadSeparators();
   let contexts = [];
   let separatingWords = [];
   let start = 0;
   let i = 0;
   while (i < this.length) {
      let expression = this[i];
      if (expression.regex_char == '!' || expression.regex_char == 'I') {
         contexts.push(new Context(start, i));
         start = i + 1;
      } else {
         for (const separator of separators.expressions) {
            let matches = [...expression.text.matchAll(new RegExp(separator.text))];
            if (matches.length == 1 && matches[0].index == matches[0].input.length - 1) {
               expression.text = expression.text.substring(0, expression.text.length - 1);
               contexts.push(new Context(start, i));
               start = i + 1;
               separatingWords.push(i);
            }
         }
      }
      i++
   }
   if (start < this.length) {
      contexts.push(new Context(start, this.length - 1));
   }
   return { separatingWords, contexts };
}

/**
 * @this {{regchars: String, expressions: Array.<Expression>}}
 * @param {Number} index 
 * @param {Boolean} replacePrepositions 
 * @param {Boolean} allPrepositions 
 * @returns {Array.<Number>}
 */
function markIndexes(index, end, replacePrepositions, allPrepositions) {
   let prevChar = this.regchars[index - 1];
   if (replacePrepositions && (prevChar == 'p' || (allPrepositions && prevChar == 'P'))) {
      this.regchars = replaceAt(this.regchars, index - 1, '.');
      index--;
      end++;
   }
   let indexes = [];
   for (let i = Math.max(0, index); i < Math.min(index + end, this.expressions.length); i++) {
      this.regchars = replaceAt(this.regchars, i, '.');
      indexes.push(i);
   }
   return indexes;
}

/**
 * @param {ContextsData} contextsData
 * @param {Array.<Number>} indexes 
 * @returns {Number} 
 */
function findCorrespondingContext(contextsData, indexes) {
   let i = indexes.length;
   const contexts = contextsData.contexts;
   while (i--) {
      let index = indexes[i];
      let j = contexts.length;
      while (j--) {
         let start = contexts[j].start;
         let end = contexts[j].end;
         if (start <= index && index <= end) {
            return j;
         }
      }
   }
   return -1;
}

/**
 * @param {ContextsData} contextsData
 * @param {Array.<Number>} indexes 
 * @returns {Number} 
 */
function processContexts(contextsData, indexes) {
   let context = findCorrespondingContext(contextsData, indexes);
   if (!contextsData.usedContexts.includes(context)) {
      contextsData.usedContexts.push(context);
   }
   return context;
}

const numberAndWordPrevalence = 50;
const numberAndWordParseCases = [
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/ns/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.seconds, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nm/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nh/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/n[dS]/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nw/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text * 7;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nQ{0,1}M/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, num, indexes, context, prevalence, { validMode }));
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.months, this.expressions[match.index + match[0].length - 1].value, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nK/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         if (0 < num) {
            let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.nMonth, num, indexes, context, prevalence));
         }
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/[nN]y/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index].text;
         let max = this.expressions[match.index + match[0].length - 1].maximum;
         let validMode = ValidModes.notCertified;
         if (num > max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.years, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/s/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.seconds, 1, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/m/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, 1, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/h/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, 1, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/w/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, 7, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/K/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.nMonth, 1, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/y/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.years, 1, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/d/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         let value = this.expressions[match.index].value;;
         if(value == 0) {
            value = 1;
         } else {
            const now = new Date();
            value = now.getDate() + GetDaysToDayOfWeek(value);
         }
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, value, indexes, context, prevalence, { validMode: ValidModes.notValid }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/0/g)];
      for (const match of matches) {
         let text = this.expressions[match.index].text
         let num = +text.substring(0, text.length - 1);
         let max = this.expressions[match.index].maximum;
         let validMode = ValidModes.notCertified;
         if (num >= max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.seconds, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/1/g)];
      for (const match of matches) {
         let text = this.expressions[match.index].text
         let num = +text.substring(0, text.length - 1);
         let max = this.expressions[match.index].maximum;
         let validMode = ValidModes.notCertified;
         if (num >= max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/2/g)];
      for (const match of matches) {
         let text = this.expressions[match.index].text
         let num = +text.substring(0, text.length - 1);
         let max = this.expressions[match.index].maximum;
         let validMode = ValidModes.notCertified;
         if (num >= max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/3/g)];
      for (const match of matches) {
         let text = this.expressions[match.index].text
         let num = +text.substring(0, text.length - 1);
         let max = this.expressions[match.index].maximum;
         let validMode = ValidModes.notCertified;
         if (num >= max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/4/g)];
      for (const match of matches) {
         let text = this.expressions[match.index].text
         let num = +text.substring(0, text.length - 1);
         let max = this.expressions[match.index].maximum;
         let validMode = ValidModes.notCertified;
         if (num >= max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.months, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   }),
   new ParseCase(numberAndWordPrevalence, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/5/g)];
      for (const match of matches) {
         let text = this.expressions[match.index].text
         let num = +text.substring(0, text.length - 1);
         let max = this.expressions[match.index].maximum;
         let validMode = ValidModes.notCertified;
         if (num >= max && max != 0) {
            validMode = ValidModes.notValid;
         }
         let indexes = markIndexes.call(this, match.index, match[0].length, true, false);
         let context = processContexts(contextsData, indexes);
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.years, num, indexes, context, prevalence, { validMode }));
      }
      return parsedTimes;
   })
];

function checkHours(value) {
   return 0 <= value && value <= 24;
}
function checkMinutes(value) {
   return 0 <= value && value <= 59;
}
function isLeapYear(year) {
   return (year & 3) == 0 && ((year % 25) != 0 || (year & 15) == 0);
}
function checkDate(date, month, year) {
   const monthSize = LoadMonthSize(month);
   return monthSize != null && 0 <= date && date <= (isLeapYear(year) ? monthSize.leap_count : monthSize.normal_count);
}
function checkMonth(month) {
   return 0 <= month && month <= 12;
}
function checkYear(year) {
   return 0 <= year;
}
function processHour(hour, partOfDay) {
   if (0 < partOfDay) {
      if (partOfDay <= 4) {
         let l1 = (6 * partOfDay) % 24;
         let l2 = (6 * (partOfDay + 1)) % 24;
         if ((l1 < hour && hour <= l1 + 6) || (l2 <= hour && hour <= l2 + 6)) {
            if (hour >= 12) {
               return hour - 12;
            } else {
               return hour + 12;
            }
         }
      } else if (partOfDay <= 6) {
         if (hour >= 12 && partOfDay == 5) {
            return hour - 12;
         } else if (hour < 12 && partOfDay == 6) {
            return hour + 12;
         }
      }
      return hour;
   }
}

function GetDaysToDayOfWeek(dayOfWeek) {
   let now = new Date();
   let dif = dayOfWeek - (now.getDay() + 1);
   if (dif < 0) {
      dif += 7;
   }
   return dif;
}

const parseCases = [
   //Searchs for DD.MM().Y-YYYY) cases
   new ParseCase(75, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/D/g)];
      for (const match of matches) {
         let vals = this.expressions[match.index].text.split(/\./);
         let date = +vals[0];
         let month = +vals[1];
         let year = -1;
         if (vals.length > 2) {
            year = +vals[2];
         }
         if (
            checkDate(date, month, year)
            && checkMonth(month)
            && (year == -1 || checkYear(year))
         ) {
            let indexes = markIndexes.call(this, match.index, 1, true, true);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, date, indexes, context, prevalence, { validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.months, month, indexes, context, prevalence, { validMode: ValidModes.certified }));
            if (year != -1) {
               parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.years, year, indexes, context, prevalence, { validMode: ValidModes.certified }));
            }
         } else if (checkHours(date) && checkMinutes(month) && vals.length == 2) {
            this.regchars = replaceAt(this.regchars, match.index, 't');
         }
      }
      return parsedTimes;
   }),
   //Searchs for HH:MM(:SS) cases
   new ParseCase(75, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/t/g)];
      for (const match of matches) {
         let vals = this.expressions[match.index].text.split(/[:\.]/);
         let hours = +vals[0];
         let minutes = +vals[1];
         let seconds = -1;
         if (vals.length > 2) {
            if (match[0][2] == match[0][5] || match[0][1] == match[0][5]) {
               seconds = +vals[2];
            } else {
               hours = 100;
            }
         }
         if (checkHours(hours) && checkMinutes(minutes) && (seconds == -1 || checkMinutes(seconds))) {
            let indexes = markIndexes.call(this, match.index, 1, true, true);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, hours, indexes, context, prevalence, { isFixed: true }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, minutes, indexes, context, prevalence));
            if (seconds != -1) {
               parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.seconds, seconds, indexes, context, prevalence));
            }
         }
      }
      return parsedTimes;
   }),
   //Searchs for weeks cases
   new ParseCase(80, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/[FpP]d/g)];
      for (const match of matches) {
         const length = match[0].length;
         let value = this.expressions[match.index + length - 1].value;
         if (value != 0) {
            let dif = GetDaysToDayOfWeek(value);
            if (match[0][0] == 'F' && dif == 0) {
               dif += 7;
            }
            let indexes = markIndexes.call(this, match.index, length, true, true);
            let context = processContexts(contextsData, indexes);
            const now = new Date();
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, now.getDate() + dif, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for "in without X minutes" cases
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/[pP]BnnO{0,1}/g)];
      for (const match of matches) {
         const length = match[0].length;
         let minutes = +this.expressions[match.index + 2].text;
         let hours = +this.expressions[match.index + 3].text;
         if (1 <= hours <= 25 && 0 < minutes && minutes < 60) {
            let isFixed = false;
            if (match[0][length - 1] == 'O') {
               hours = processHour(hours, this.expressions[match.index + length - 1].value);
               isFixed = true;
            }
            hours--;
            minutes = 60 - minutes;
            let indexes = markIndexes.call(this, match.index, length, false, false);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, hours, indexes, context, prevalence, { isFixed, validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, minutes, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for without X minutes cases
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/Bnm{0,1}n[Oh]O{0,1}/g)];
      for (const match of matches) {
         const length = match[0].length;
         let minutes = +this.expressions[match.index + 1].text;
         let num;
         if (match[0][2] == 'm') {
            num = +this.expressions[match.index + 3].text;
         } else {
            num = +this.expressions[match.index + 2].text;
         }
         if (1 <= num <= 25 && 0 < minutes && minutes < 60) {
            let isFixed = false;
            if (match[0][length - 1] == 'O') {
               num = processHour(num, this.expressions[match.index + length - 1].value);
               isFixed = true;
            }
            num--;
            minutes = 60 - minutes;
            let indexes = markIndexes.call(this, match.index, length, true, false);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { isFixed, validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, minutes, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for without X minutes cases on EN
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nm{0,1}Bn[Oh]O{0,1}/g)];
      for (const match of matches) {
         const length = match[0].length;
         let minutes = +this.expressions[match.index].text;
         let num;
         if (match[0][1] == 'm') {
            num = +this.expressions[match.index + 3].text;
         } else {
            num = +this.expressions[match.index + 2].text;
         }
         if (1 <= num <= 25 && 0 < minutes && minutes < 60) {
            let isFixed = false;
            if (match[0][length - 1] == 'O') {
               num = processHour(num, this.expressions[match.index + length - 1].value);
               isFixed = true;
            }
            num--;
            minutes = 60 - minutes;
            let indexes = markIndexes.call(this, match.index, length, true, false);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { isFixed, validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, minutes, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for half past hour (RU)
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/HnO{0,1}/g)];
      for (const match of matches) {
         let num = +this.expressions[match.index + 1].text - 1;
         if (0 <= num <= 23) {
            let isFixed = false;
            if (match[0][match[0].length - 1] == 'O') {
               num = processHour(num, this.expressions[match.index + offset + 2].value);
               isFixed = true;
            }
            let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { isFixed, validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, 30, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for half past hour
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/HL{0,1}n(O{1}|h{0,1})/g)];
      for (const match of matches) {
         let offset = 0;
         if (match[0][1] == 'L') {
            offset = 1;
         }
         let num = +this.expressions[match.index + offset + 1].text;
         if ((offset == 1 ? 0 : 1) <= num <= (offset == 1 ? 23 : 24)) {
            let isFixed = false;
            if (match[0][match[0].length - 1] == 'O') {
               num = processHour(num, this.expressions[match.index + offset + 2].value);
               isFixed = true;
            }
            if (offset == 0) {
               num--;
            }
            let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { isFixed, validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, 30, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for simplified specification of hours and time of day
   new ParseCase(75, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/nO/g)];
      for (const match of matches) {
         let value = this.expressions[match.index + 1].value;
         let num = +this.expressions[match.index].text;
         if (checkHours(num)) {
            num = processHour(num, value);
            let indexes = markIndexes.call(this, match.index, match[0].length, true, true);
            let context = processContexts(contextsData, indexes);
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, num, indexes, context, prevalence, { isFixed: true, validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for "after 'A'"
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/CA/g)];
      for (const match of matches) {
         let value = this.expressions[match.index + 1].value + 1;
         let indexes = markIndexes.call(this, match.index, 2, true, true);
         let context = processContexts(contextsData, indexes);
         const now = new Date();
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, now.getDate() + value, indexes, context, prevalence, { validMode: ValidModes.certified }));
      }
      return parsedTimes;
   }),
   //Searchs for "after 'X'"
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/CX/g)];
      for (const match of matches) {
         let indexes = markIndexes.call(this, match.index, match[0].length, false, true);
         let context = processContexts(contextsData, indexes);
         const now = new Date();
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.hours, now.getUTCHours(), indexes, context, prevalence, { isOffset: true, validMode: ValidModes.certified }));
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.minutes, now.getUTCMinutes() + 30, indexes, context, prevalence, { isOffset: true, validMode: ValidModes.certified }));

         const notFoundTimeTypes = [TimeTypes.dates, TimeTypes.months, TimeTypes.seconds, TimeTypes.years];
         for (const timeType of notFoundTimeTypes) {
            parsedTimes.push(new ParsedTime(DateTypes.target, timeType, getDateProperty(now, timeType, true), indexes, context, prevalence, { isOffset: true, validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   }),
   //Searchs for tomorrow and after tomorrow cases
   new ParseCase(60, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/A/g)];
      for (const match of matches) {
         let value = this.expressions[match.index].value;
         let indexes = markIndexes.call(this, match.index, 1, true, true);
         let context = processContexts(contextsData, indexes);
         const now = new Date();
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, now.getDate() + value, indexes, context, prevalence, { validMode: ValidModes.certified }));
         parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.months, now.getMonth() + 1, indexes, context, prevalence, { validMode: ValidModes.certified }));
      }
      return parsedTimes;
   }),
   //Searchs for "every day" cases
   new ParseCase(60, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/Ed/g)];
      for (const match of matches) {
         let value = this.expressions[match.index + 1].value;
         let indexes = markIndexes.call(this, match.index, 2, true, false);
         let context = processContexts(contextsData, indexes);
         const now = new Date();
         if (value == 0) {
            parsedTimes.push(new ParsedTime(DateTypes.period, TimeTypes.dates, 1, indexes, context, prevalence, { validMode: ValidModes.certified }));
         } else {
            let dif = value - (now.getDay() + 1);
            if (dif < 0) {
               dif += 7;
            }
            parsedTimes.push(new ParsedTime(DateTypes.period, TimeTypes.dates, 7, indexes, context, prevalence, { validMode: ValidModes.certified }));
            parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.dates, now.getDate() + dif, indexes, context, prevalence, { validMode: ValidModes.certified }));
         }
      }
      return parsedTimes;
   })
];

/**
 * @param {Array.<ParsedTime>} parsedTimes 
 * @param {Number} index 
 * @returns {Array.<Number>}
 */
function findParsedTimesByIndex(parsedTimes, index) {
   let i = parsedTimes.length;
   let result = [];
   while (i--) {
      if (parsedTimes[i].indexes.includes(index)) {
         result.push(i);
      }
   }
   return result;
}

/**
 * @param {Array.<TimeTypes>} allowedTypes 
 * @param {Number} step 
 * @param {Number} start 
 * @param {Array.<Expression>} expressions 
 * @param {Array.<ParsedTime>} parsedTimes 
 * @param {ValidModes} ignoreValidMode 
 * @returns {Array.<Number>}
 */
function findAllMatchingParsedTimes(allowedTypes, step, start, expressions, parsedTimes, ignoreValidMode) {
   if (typeof (ignoreValidMode) == 'undefined') {
      ignoreValidMode = ValidModes.certified;
   }
   let i = start + step;
   let proceed = true;
   let result = [];
   while (proceed && (0 <= i && i < expressions.length)) {
      let indexes = findParsedTimesByIndex(parsedTimes, i);
      if (indexes.length > 0) {
         let newIndexes = [];
         for (const index of indexes) {
            const parsedTime = parsedTimes[index];
            if (allowedTypes.includes(parsedTime.timeType) && parsedTime.validMode != ignoreValidMode) {
               if (!result.includes(index)) {
                  newIndexes.push(index);
               }
            } else {
               proceed = false;
               newIndexes = [];
               break;
            }
         }
         if (newIndexes.length > 0) {
            result.push(...newIndexes);
         }
      } else {
         proceed = false;
      }
      i += step;
   }
   return result;
}

const finalParseCases = [
   //Searchs for time of day specification
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/O/g)];
      for (const match of matches) {
         const allowedTypes = [TimeTypes.hours, TimeTypes.minutes, TimeTypes.seconds]
         parsedTimes.sort((a, b) => {
            return a.indexes[0] - b.indexes[0];
         });
         let parsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, -1, match.index, this.expressions, parsedTimes);
         if (parsedTimesIndexes.length == 0) {
            parsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, 1, match.index, this.expressions, parsedTimes);
         }
         if (parsedTimesIndexes.length > 0) {
            let i = parsedTimesIndexes.length;
            let proceed = true;
            while (proceed && i--) {
               let parsedTime = parsedTimes[parsedTimesIndexes[i]];
               if (parsedTime.timeType == TimeTypes.hours) {
                  parsedTime.number = processHour(parsedTime.number, this.expressions[match.index].value);
                  parsedTime.prevalence += prevalence;
                  proceed = false;
                  parsedTime.isFixed = true;
               }
            }
            if (i >= 0) {
               parsedTimes[parsedTimesIndexes[i]].indexes.push(...markIndexes.call(this, match.index, 1, true, true));
            }
         }
      }
      return parsedTimes;
   }),
   //Searchs for "after X time"
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/C/g)];
      for (const match of matches) {
         const allowedTypes = [TimeTypes.years, TimeTypes.dates, TimeTypes.nMonth, TimeTypes.hours, TimeTypes.minutes, TimeTypes.seconds];
         parsedTimes.sort((a, b) => {
            return a.indexes[0] - b.indexes[0];
         });
         let parsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, 1, match.index, this.expressions, parsedTimes).sort();
         if (parsedTimesIndexes.length > 0) {
            let i = parsedTimesIndexes.length;
            const now = new Date();
            const indexes = markIndexes.call(this, match.index, 1, true, false);
            const context = processContexts(contextsData, indexes);
            let notFoundTimeTypes = [TimeTypes.dates, TimeTypes.hours, TimeTypes.minutes, TimeTypes.months, TimeTypes.seconds, TimeTypes.years];
            while (i--) {
               let parsedTime = parsedTimes[parsedTimesIndexes[i]];
               let index = notFoundTimeTypes.indexOf(parsedTime.timeType);
               if (index != -1) {
                  notFoundTimeTypes.splice(index, 1);
               }
               if (parsedTime.timeType == TimeTypes.nMonth) {
                  parsedTimes.push(new ParsedTime(DateTypes.target, TimeTypes.months, now.getMonth() + 1 + parsedTime.number, parsedTime.indexes, context, prevalence, { isOffset: true }));
                  parsedTimes.splice(parsedTimesIndexes[i], 1);
                  notFoundTimeTypes.splice(notFoundTimeTypes.indexOf(TimeTypes.months), 1);
               } else {
                  parsedTime.number = getDateProperty(now, parsedTime.timeType, true) + parsedTime.number;
               }
               parsedTime.prevalence += prevalence;
               parsedTime.indexes.push(...indexes);
               parsedTime.validMode = ValidModes.certified;
            }
            for (const timeType of notFoundTimeTypes) {
               parsedTimes.push(new ParsedTime(DateTypes.target, timeType, getDateProperty(now, timeType, true), indexes, context, prevalence, { isOffset: true }));
            }
         }
      }
      return parsedTimes;
   }),
   //Searchs for "from X time to Y time"
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/V\.+I{0,1}[ZB]\.+/g)];
      for (const match of matches) {
         const allowedTypes = [TimeTypes.years, TimeTypes.dates, TimeTypes.months, TimeTypes.hours, TimeTypes.minutes, TimeTypes.seconds];
         parsedTimes.sort((a, b) => {
            return a.indexes[0] - b.indexes[0];
         });
         let fromParsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, 1, match.index, this.expressions, parsedTimes, ValidModes.none).sort();
         if (fromParsedTimesIndexes.length > 0) {
            let foundTimeTypes = [];
            let proceed = true;
            for (const i of fromParsedTimesIndexes) {
               let parsedTime = parsedTimes[i];
               if (foundTimeTypes.includes(parsedTime.timeType)) {
                  proceed = false;
                  break;
               } else {
                  foundTimeTypes.push(parsedTime.timeType);
               }
            }
            if (proceed) {
               let zIndex = match.index + match[0].match(/[ZB]/).index;
               let toParsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, 1, zIndex, this.expressions, parsedTimes, ValidModes.none).sort();
               if (toParsedTimesIndexes.length > 0) {
                  foundTimeTypes = [];
                  for (const i of toParsedTimesIndexes) {
                     let parsedTime = parsedTimes[i];
                     if (foundTimeTypes.includes(parsedTime.timeType)) {
                        proceed = false;
                        break;
                     } else {
                        foundTimeTypes.push(parsedTime.timeType);
                     }
                  }
                  if (proceed) {
                     for (const i of fromParsedTimesIndexes) {
                        let parsedTime = parsedTimes[i];
                        parsedTime.indexes.unshift(match.index);
                        parsedTime.validMode = ValidModes.certified;
                        parsedTime.prevalence += prevalence;
                     }
                     for (const i of toParsedTimesIndexes) {
                        let parsedTime = parsedTimes[i];
                        parsedTime.dateType = DateTypes.max;
                        parsedTime.indexes.unshift(zIndex);
                        parsedTime.validMode = ValidModes.certified;
                        parsedTime.prevalence += prevalence;
                     }
                  }
               }
            }
         }
      }
      return parsedTimes;
   }),
   //Searchs for "to X time"
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/Z\.+/g)];
      for (const match of matches) {
         const allowedTypes = [TimeTypes.years, TimeTypes.dates, TimeTypes.months, TimeTypes.hours, TimeTypes.minutes, TimeTypes.seconds];
         parsedTimes.sort((a, b) => {
            return a.indexes[0] - b.indexes[0];
         });
         let toParsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, 1, match.index, this.expressions, parsedTimes).sort();
         let proceed = true;
         if (toParsedTimesIndexes.length > 0) {
            foundTimeTypes = [];
            for (const i of toParsedTimesIndexes) {
               let parsedTime = parsedTimes[i];
               if (foundTimeTypes.includes(parsedTime.timeType)) {
                  proceed = false;
                  break;
               } else {
                  foundTimeTypes.push(parsedTime.timeType);
               }
            }
            if (proceed) {
               for (const i of toParsedTimesIndexes) {
                  let parsedTime = parsedTimes[i];
                  parsedTime.dateType = DateTypes.max;
                  parsedTime.indexes.unshift(match.index);
                  parsedTime.validMode = ValidModes.certified;
                  parsedTime.prevalence += prevalence;
               }
            }
         }
      }
      return parsedTimes;
   }),
   //Searchs for "every X time"
   new ParseCase(90, function (parsedTimes, contextsData, prevalence) {
      let matches = [...this.regchars.matchAll(/E\.+/g)];
      for (const match of matches) {
         const allowedTypes = [TimeTypes.years, TimeTypes.dates, TimeTypes.nMonth, TimeTypes.hours, TimeTypes.minutes, TimeTypes.seconds];
         parsedTimes.sort((a, b) => {
            return a.indexes[0] - b.indexes[0];
         });
         let parsedTimesIndexes = findAllMatchingParsedTimes(allowedTypes, 1, match.index, this.expressions, parsedTimes).sort();
         if (parsedTimes.length > 0) {
            let indexes = markIndexes.call(this, match.index, 1, true, false);
            let foundTimeTypes = [];
            for (const i in parsedTimesIndexes) {
               const index = parsedTimesIndexes[i];
               let parsedTime = parsedTimes[index];
               if (foundTimeTypes.includes(parsedTime.timeType)) {
                  parsedTimesIndexes.splice(i);
                  break;
               } else {
                  indexes.push(...parsedTime.indexes);
                  foundTimeTypes.push(parsedTime.timeType);
               }
            }
            let i = parsedTimesIndexes.length;
            while (i--) {
               const index = parsedTimesIndexes[i];
               let parsedTime = parsedTimes[index];
               parsedTime.dateType = DateTypes.period;
               parsedTime.indexes = indexes;
               parsedTime.validMode = ValidModes.certified;
               parsedTime.prevalence += prevalence;
               if (parsedTime.timeType == TimeTypes.nMonth) {
                  parsedTime.timeType = TimeTypes.months;
               }
            }
         }
      }
      return parsedTimes;
   })
];

/**
 * @param {Array.<Expression>} expressions 
 * @param {Number} minimumPrevalence the less ??? the more results
 * @returns {{parsedTimes: Array.<ParsedTime>, contextsData: ContextsData, separatingWords: Array.<Number>}} object containing all found times 
 */
function extractTime(expressions, minimumPrevalence) {
   let parsedTimes = [];
   let expressionsSet = {
      regchars: '',
      expressions
   };
   for (const expression of expressions) {
      expressionsSet.regchars += expression.regex_char;
   }
   let contextsData = new ContextsData();
   let res = splitContext.call(expressions);
   contextsData.contexts = res.contexts;
   let separatingWords = res.separatingWords;
   for (const parseCase of parseCases) {
      if (parseCase.prevalence >= minimumPrevalence) {
         parsedTimes = parseCase.parseFunction.call(expressionsSet, parsedTimes, contextsData, parseCase.prevalence);
      }
   }
   if (numberAndWordPrevalence >= minimumPrevalence) {
      for (const parseCase of numberAndWordParseCases) {
         parsedTimes = parseCase.parseFunction.call(expressionsSet, parsedTimes, contextsData, parseCase.prevalence);
      }
   }
   for (const parseCase of finalParseCases) {
      if (parseCase.prevalence >= minimumPrevalence) {
         parsedTimes = parseCase.parseFunction.call(expressionsSet, parsedTimes, contextsData, parseCase.prevalence);
      }
   }
   return { parsedTimes, contextsData, separatingWords };
}

module.exports = {
   DateTypes,
   isDateType,
   TimeTypes,
   isTimeType,
   setDateProperty,
   getDateProperty,
   ValidModes,
   ParsedTime,
   Context,
   ContextsData,
   extractTime
}