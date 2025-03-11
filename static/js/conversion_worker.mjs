import { ConversionEngine } from "./conversion_engine.mjs?v=5";

/**
 * @typedef { import("./conversion_engine.mjs").GJGameLevel } GJGameLevel
 * @typedef { import("./conversion_engine.mjs").ConversionReport } ConversionReport
 */

/**
 * global level object to ease js -> python conversion.
 * workers are weird
 * @type {Object.<number, GJGameLevel>}
 */
let levels = {};

/**
 * global reports object to ease js -> python conversion.
 * @type {Object.<number, ConversionReport>}
 */
let reports = {};

addEventListener("message", async (event) => {
	const { type, promise_id, args } = event.data;

	try {
		switch (type) {
			case "initialize_engine": {
				await ConversionEngine.initialize_engine();
				post_success_message(promise_id, undefined);
				break;
			}
			case "set_level_converter_wheel": {
				const [wheel] = args;
				ConversionEngine.set_level_converter_wheel(wheel);
				post_success_message(promise_id, undefined);
				break;
			}
			case "get_conversion_groups": {
				const groups = ConversionEngine.get_conversion_groups();
				post_success_message(promise_id, groups);
				break;
			}
			case "get_metagroup": {
				const [name] = args;
				const metagroup = ConversionEngine.get_metagroup(name);
				post_success_message(promise_id, metagroup);
				break;
			}
			case "get_gmd_info": {
				const [lvl] = args;
				const gmd = ConversionEngine.get_gmd_info(lvl);

				// store level and send a serializable object
				levels[promise_id] = gmd;
				post_success_message(promise_id, {
					_tracking_id: promise_id,
					name: gmd.name,
					description: gmd.description
				});
				break;
			}
			case "run_conversion": {
				const [level, groups] = args;

				// pull level from storage
				const py_level = levels[level._tracking_id]

				// store report and send serializable object
				const report = ConversionEngine.run_conversion(py_level, groups);
				reports[promise_id] = report;

				post_success_message(promise_id, {
					// the actual contents of the removed objects currently doesn't matter
					// if it does, this can be easily fixed
					_tracking_id: promise_id,
					removed_objects: Array(...report.removed_objects).map(x => null),
					preconversion_object_count: report.preconversion_object_count
				});
				break;
			}
			case "level_to_gmd": {
				const [level] = args;
				const py_level = levels[level._tracking_id]

				const gmd = py_level.to_gmd();
				post_success_message(promise_id, gmd);
				break;
			}
			case "parse_reports": {
				const [report] = args;
				const py_report = reports[report._tracking_id]

				const parsed_report = ConversionEngine.parse_reports(py_report);

				post_success_message(promise_id, parsed_report);
				break;
			}
			case "reset_state": {
				levels = {};
				reports = {};
				post_success_message(promise_id, undefined);
				break;
			}
			case "get_version": {
				const version = ConversionEngine.get_version();

				post_success_message(promise_id, version);
				break;
			}
			default:
				throw new TypeError(`unrecognized message type: ${type}`);
		}
	} catch(e) {
		try {
			structuredClone(e);
			postMessage({ promise_id, value: e, success: false });
		} catch (_) {
			// firefox workaround. PythonErrors don't structuredClone properly (for whatever reason)
			// so, create a new object and copy the properties there
			const cloned_error = {
				message: e.message,
				name: e.name,
				stack: e.stack,
				_firefox_workaround_why_is_this_an_issue: true,
			}
			postMessage({ promise_id, value: cloned_error, success: false });
		}
	}
});

/**
 * posts a success message to the window
 * @template T
 * @param {number} promise_id
 * @param {T} value
 */
function post_success_message(promise_id, value) {
	postMessage({ promise_id, value, success: true });
}